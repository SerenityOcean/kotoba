package com.keshi.kotoba.library;

import com.keshi.kotoba.pay.AlipayClient;
import com.keshi.kotoba.web.RateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * 用支付宝买资料包：下单、确认付款、发解锁记录。
 *
 * <p>「付了」只认两个来源：支付宝的异步通知（验签），和后端主动查单。浏览器从支付宝跳回来的那一下
 * 谁都能伪造，前端拿到 ?order= 之后只是开始轮询，真正的确认在这里。两个来源可能同时到，
 * 确认时锁住订单那一行，谁先谁后都只发一次。
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    /** 多久不付就让支付宝关单。 */
    static final Duration PAY_WINDOW = Duration.ofMinutes(15);
    /** 弹层里二维码的宽度（像素）。 */
    static final int QR_WIDTH = 168;
    /** 超过这么久还没付的单，轮询时不再去问支付宝。 */
    private static final Duration QUERY_HORIZON = Duration.ofDays(1);

    private static final DateTimeFormatter ORDER_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Shanghai"));
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PackRepository packs;
    private final PackOrderRepository orders;
    private final Grants grants;
    private final ObjectProvider<AlipayClient> alipay;
    private final TransactionTemplate tx;
    private final String baseUrl;
    /** 前端每两三秒问一次订单状态，每次都去查支付宝没必要，也别让人拿这个接口刷支付宝。 */
    private final RateLimiter queryLimiter;

    public OrderService(PackRepository packs, PackOrderRepository orders, Grants grants,
                        ObjectProvider<AlipayClient> alipay, PlatformTransactionManager transactions,
                        @Value("${app.base-url}") String baseUrl, Clock clock) {
        this.packs = packs;
        this.orders = orders;
        this.grants = grants;
        this.alipay = alipay;
        this.tx = new TransactionTemplate(transactions);
        this.baseUrl = baseUrl;
        this.queryLimiter = new RateLimiter(1, Duration.ofSeconds(2), clock);
    }

    /**
     * @param qrUrl  电脑上放进 iframe 的嵌入式二维码；手机上是 null
     * @param payUrl 整页跳去支付宝的地址：电脑上是收银台，手机上会拉起支付宝 App
     */
    public record Checkout(String orderNo, String qrUrl, String payUrl) {
    }

    public record OrderState(PackOrder.Status status, String pack) {
    }

    public Checkout checkout(Long userId, String slug, boolean mobile, Instant now) {
        AlipayClient client = alipay.getIfAvailable();
        if (client == null) {
            throw new PaymentUnavailableException();
        }
        Pack pack = packs.findBySlug(slug)
                .filter(Pack::onSale)
                .orElseThrow(() -> new IllegalArgumentException("这个资料包现在还不能买"));
        if (grants.owns(userId, pack.getId())) {
            throw new AlreadyOwnedException("你已经解锁「" + pack.getTitle() + "」了");
        }

        // 十分钟内下过、还没付的单接着用：同一个订单号重新拿支付地址，支付宝认得出是同一笔
        PackOrder order = orders
                .findFirstByUserIdAndPackIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
                        userId, pack.getId(), PackOrder.Status.CREATED, now.minus(Duration.ofMinutes(10)))
                .filter(o -> o.amount().equals(BigDecimal.valueOf(pack.getPriceCents(), 2)))
                .orElseGet(() -> orders.save(new PackOrder(newOrderNo(now), userId, pack.getId(),
                        pack.getPriceCents(), now)));

        String back = baseUrl + "/library/" + pack.getSlug();
        AlipayClient.PayRequest request = new AlipayClient.PayRequest(
                order.getOutTradeNo(), "言葉 · " + pack.getTitle(), order.amount().toPlainString(),
                back + "?order=" + order.getOutTradeNo(), order.getCreatedAt().plus(PAY_WINDOW));
        return mobile
                ? new Checkout(order.getOutTradeNo(), null, client.wapPayUrl(request, back))
                : new Checkout(order.getOutTradeNo(), client.pagePayUrl(request, QR_WIDTH),
                        client.pagePayUrl(request, null));
    }

    /** 前端轮询。还没付的话顺手去支付宝查一下（限频），查到付了就当场确认。 */
    public OrderState state(Long userId, String orderNo, Instant now) {
        PackOrder order = orders.findByOutTradeNo(orderNo)
                .filter(o -> o.getUserId().equals(userId))
                .orElseThrow(() -> new LibraryNotFoundException("没有这笔订单"));
        String slug = packs.findById(order.getPackId()).map(Pack::getSlug).orElse(null);

        AlipayClient client = alipay.getIfAvailable();
        if (order.paid() || client == null || order.getCreatedAt().isBefore(now.minus(QUERY_HORIZON))
                || queryLimiter.tryAcquire(orderNo) != null) {
            return new OrderState(order.getStatus(), slug);
        }
        try {
            AlipayClient.Trade trade = client.query(orderNo);
            if (trade.paid() && confirm(orderNo, trade.tradeNo(), trade.totalAmount(), now)) {
                return new OrderState(PackOrder.Status.PAID, slug);
            }
        } catch (RuntimeException e) {
            // 查不到（网络、支付宝那边出错）这一轮就算了，下一轮再问；异步通知也还会来
            log.warn("查单 {} 失败：{}", orderNo, e.getMessage());
        }
        return new OrderState(order.getStatus(), slug);
    }

    /**
     * 支付宝的异步通知。返回 true 时回「success」，支付宝就不再重发；false 回「failure」，它会隔一阵再发。
     * 不是付成功的通知（等待付款、关单）也回 true：收到了，只是没什么要做的。
     */
    public boolean onNotify(Map<String, String> params, Instant now) {
        AlipayClient client = alipay.getIfAvailable();
        if (client == null || !client.verifyNotify(params)) {
            log.warn("支付宝通知验签没过：{}", params.get("out_trade_no"));
            return false;
        }
        String status = params.get("trade_status");
        if (!"TRADE_SUCCESS".equals(status) && !"TRADE_FINISHED".equals(status)) {
            return true;
        }
        return confirm(params.get("out_trade_no"), params.get("trade_no"), params.get("total_amount"), now);
    }

    /**
     * 确认一笔付款：核对金额，标成已付，发解锁记录。已经确认过的直接算成功。
     * 金额对不上不发 —— 只可能是有人拿别的订单的通知来凑，记一笔日志。
     */
    boolean confirm(String outTradeNo, String tradeNo, String totalAmount, Instant now) {
        Boolean done = tx.execute(status -> {
            PackOrder order = orders.lockByOutTradeNo(outTradeNo).orElse(null);
            if (order == null) {
                log.warn("支付宝通知了一笔不认识的订单：{}", outTradeNo);
                return false;
            }
            if (order.paid()) {
                return true;
            }
            if (totalAmount == null || new BigDecimal(totalAmount).compareTo(order.amount()) != 0) {
                log.error("订单 {} 金额对不上：应付 {}，支付宝说 {}", outTradeNo, order.amount(), totalAmount);
                return false;
            }
            order.markPaid(tradeNo, now);
            if (!grants.grant(order.getUserId(), order.getPackId(), Grants.Source.ALIPAY, outTradeNo, now)) {
                // 已经用别的办法（兑换码、另一笔订单）解锁过了：钱收重了，要手动退
                log.warn("订单 {} 付了款，但用户 {} 早就有这个包了，记得退款（支付宝交易号 {}）",
                        outTradeNo, order.getUserId(), tradeNo);
            }
            return true;
        });
        return Boolean.TRUE.equals(done);
    }

    /** KB + 东八区下单时刻 + 6 位随机数：看一眼就知道哪天下的，也不会撞。 */
    private static String newOrderNo(Instant now) {
        return "KB" + ORDER_TIME.format(now) + String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
