package com.keshi.kotoba.pay;

import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 支付宝开放平台，只用到三样：电脑网站支付（alipay.trade.page.pay）、手机网站支付
 * （alipay.trade.wap.pay）、查单（alipay.trade.query）。没上官方 SDK —— 三个接口用不着
 * 一整套，自己签名也看得清每一步。沙箱和正式环境只差网关地址和那几把钥匙。
 *
 * <p>两种支付都是拼一个签好名的地址，浏览器跳过去（或者放进 iframe 显示二维码）；
 * 付没付以支付宝的异步通知和主动查单为准，跳回来的那一下不算数。
 */
public class AlipayClient {

    /** 支付宝的时间都是东八区的「yyyy-MM-dd HH:mm:ss」。 */
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZONE);

    private final String gateway;
    private final String appId;
    private final PrivateKey appPrivateKey;
    private final PublicKey alipayPublicKey;
    private final String notifyUrl;
    private final RestClient http;
    private final ObjectMapper json;
    private final Clock clock;

    public AlipayClient(String gateway, String appId, PrivateKey appPrivateKey, PublicKey alipayPublicKey,
                        String notifyUrl, RestClient http, ObjectMapper json, Clock clock) {
        this.gateway = gateway;
        this.appId = appId;
        this.appPrivateKey = appPrivateKey;
        this.alipayPublicKey = alipayPublicKey;
        this.notifyUrl = notifyUrl;
        this.http = http;
        this.json = json;
        this.clock = clock;
    }

    /**
     * @param totalAmount 元，两位小数（"0.99"）
     * @param expireAt    过了这个时间还没付，支付宝就关单
     */
    public record PayRequest(String outTradeNo, String subject, String totalAmount, String returnUrl,
                             Instant expireAt) {
    }

    /**
     * 查单的结果。
     *
     * @param exists 支付宝那边有没有这笔：用户还没扫码时是没有的
     * @param status WAIT_BUYER_PAY / TRADE_SUCCESS / TRADE_FINISHED / TRADE_CLOSED
     */
    public record Trade(boolean exists, String status, String tradeNo, String totalAmount) {

        static final Trade NOT_FOUND = new Trade(false, null, null, null);

        public boolean paid() {
            return "TRADE_SUCCESS".equals(status) || "TRADE_FINISHED".equals(status);
        }
    }

    /**
     * 电脑网站支付的地址。qrWidth 不为空时是「嵌入式二维码」（qr_pay_mode=4）：
     * 这个地址放进 iframe 里只显示一个这么宽的二维码，用户在自己页面上扫；为空就是整页跳去收银台。
     */
    public String pagePayUrl(PayRequest request, Integer qrWidth) {
        Map<String, Object> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", request.outTradeNo());
        biz.put("product_code", "FAST_INSTANT_TRADE_PAY");
        biz.put("total_amount", request.totalAmount());
        biz.put("subject", request.subject());
        biz.put("time_expire", TIME.format(request.expireAt()));
        if (qrWidth != null) {
            biz.put("qr_pay_mode", "4");
            biz.put("qrcode_width", qrWidth);
        }
        return url("alipay.trade.page.pay", biz, request.returnUrl());
    }

    /** 手机网站支付的地址：手机浏览器跳过去，会拉起支付宝 App。quitUrl 是用户中途不付了回哪儿。 */
    public String wapPayUrl(PayRequest request, String quitUrl) {
        Map<String, Object> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", request.outTradeNo());
        biz.put("product_code", "QUICK_WAP_WAY");
        biz.put("total_amount", request.totalAmount());
        biz.put("subject", request.subject());
        biz.put("time_expire", TIME.format(request.expireAt()));
        biz.put("quit_url", quitUrl);
        return url("alipay.trade.wap.pay", biz, request.returnUrl());
    }

    /** 异步通知是不是支付宝发的、是不是发给这个应用的。 */
    public boolean verifyNotify(Map<String, String> params) {
        String content = AlipaySignature.content(params, Set.of("sign", "sign_type"));
        return appId.equals(params.get("app_id"))
                && AlipaySignature.verify(content, params.get("sign"), alipayPublicKey);
    }

    /**
     * 主动查一笔单。异步通知可能晚到、可能到不了（本地开发时支付宝根本连不上这台机器），
     * 前端轮询订单状态时靠它确认付没付。
     */
    public Trade query(String outTradeNo) {
        Map<String, String> params = common("alipay.trade.query", toJson(Map.of("out_trade_no", outTradeNo)), null);
        signInPlace(params);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        params.forEach(form::add);

        String body = http.post()
                .uri(gateway)
                .contentType(new MediaType(MediaType.APPLICATION_FORM_URLENCODED, StandardCharsets.UTF_8))
                .body(form)
                .retrieve()
                .body(String.class);
        return parseQuery(body);
    }

    /** 查单的响应：先拿原文验签（签的是 alipay_trade_query_response 那一段的原样文本），再读字段。 */
    Trade parseQuery(String body) {
        String node = rawObject(body, "alipay_trade_query_response");
        JsonNode root = json.readTree(body);
        if (node == null || !AlipaySignature.verify(node, root.path("sign").asString(null), alipayPublicKey)) {
            throw new AlipayException("支付宝查单的响应验签没过");
        }
        JsonNode response = json.readTree(node);
        String code = response.path("code").asString("");
        if ("10000".equals(code)) {
            return new Trade(true, response.path("trade_status").asString(null),
                    response.path("trade_no").asString(null), response.path("total_amount").asString(null));
        }
        if ("ACQ.TRADE_NOT_EXIST".equals(response.path("sub_code").asString(""))) {
            return Trade.NOT_FOUND;
        }
        throw new AlipayException("支付宝查单失败：" + response.path("sub_msg").asString(response.path("msg").asString("")));
    }

    public String appId() {
        return appId;
    }

    // ---- 拼请求 -----------------------------------------------------------

    private String url(String method, Map<String, Object> biz, String returnUrl) {
        Map<String, String> params = common(method, toJson(biz), returnUrl);
        params.put("notify_url", notifyUrl);
        signInPlace(params);
        return gateway + "?" + params.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    private Map<String, String> common(String method, String bizContent, String returnUrl) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_id", appId);
        params.put("method", method);
        params.put("format", "JSON");
        params.put("charset", "utf-8");
        params.put("sign_type", "RSA2");
        params.put("timestamp", TIME.format(clock.instant()));
        params.put("version", "1.0");
        if (returnUrl != null) {
            params.put("return_url", returnUrl);
        }
        params.put("biz_content", bizContent);
        return params;
    }

    /** 最后一步：参数都放齐了再签，签完不能再加。 */
    private void signInPlace(Map<String, String> params) {
        params.put("sign", AlipaySignature.sign(AlipaySignature.content(params, Set.of("sign")), appPrivateKey));
    }

    private String toJson(Map<String, ?> value) {
        return json.writeValueAsString(value);
    }

    /**
     * 从 JSON 原文里抠出 key 对应的那个对象的原样文本。验签要的是一字不差的原文 ——
     * 解析成树再写回去，空格、字段顺序、转义都可能变，签名就对不上了。
     */
    static String rawObject(String body, String key) {
        int at = body.indexOf("\"" + key + "\"");
        if (at < 0) {
            return null;
        }
        int start = body.indexOf('{', at + key.length() + 2);
        if (start < 0) {
            return null;
        }
        int depth = 0;
        boolean inString = false;
        for (int i = start; i < body.length(); i++) {
            char c = body.charAt(i);
            if (inString) {
                if (c == '\\') {
                    i++;
                } else if (c == '"') {
                    inString = false;
                }
            } else if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}' && --depth == 0) {
                return body.substring(start, i + 1);
            }
        }
        return null;
    }
}
