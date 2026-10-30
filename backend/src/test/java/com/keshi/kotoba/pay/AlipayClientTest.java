package com.keshi.kotoba.pay;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 不连支付宝：自己生成两对钥匙，一对当「应用」、一对当「支付宝」。
 * 应用签出去的地址用应用公钥验得过，支付宝签回来的通知和查单响应用支付宝私钥伪造 ——
 * 这正是两边各自手里的东西。
 */
class AlipayClientTest {

    private static KeyPair app;
    private static KeyPair alipay;

    private final ObjectMapper json = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-30T02:00:00Z"), ZoneOffset.UTC);

    @BeforeAll
    static void keys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        app = generator.generateKeyPair();
        alipay = generator.generateKeyPair();
    }

    private AlipayClient client() {
        return new AlipayClient("https://openapi-sandbox.dl.alipaydev.com/gateway.do", "2021000000000001",
                app.getPrivate(), alipay.getPublic(), "https://kotoba.work/api/pay/alipay/notify",
                RestClient.create(), json, clock);
    }

    private static AlipayClient.PayRequest request() {
        return new AlipayClient.PayRequest("KB20261030100000123456", "言葉 · 日语基础入门", "0.99",
                "https://kotoba.work/library/basics?order=KB20261030100000123456",
                Instant.parse("2026-10-30T02:15:00Z"));
    }

    @Test
    @DisplayName("钥匙带不带 PEM 头、有没有换行都认")
    void readsKeysWithOrWithoutPem() {
        String body = Base64.getMimeEncoder().encodeToString(app.getPrivate().getEncoded());
        String pem = "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
        String signed = AlipaySignature.sign("a=1", AlipaySignature.privateKey(pem));
        assertTrue(AlipaySignature.verify("a=1", signed, app.getPublic()));
        assertEquals(app.getPrivate(), AlipaySignature.privateKey(body));
    }

    @Test
    @DisplayName("待签串：按名字排序、去掉空值和排除的参数，值不编码")
    void buildsContentToSign() {
        Map<String, String> params = new HashMap<>();
        params.put("method", "alipay.trade.query");
        params.put("app_id", "2021");
        params.put("sign", "xxx");
        params.put("empty", "");
        params.put("biz_content", "{\"out_trade_no\":\"KB1\"}");
        assertEquals("app_id=2021&biz_content={\"out_trade_no\":\"KB1\"}&method=alipay.trade.query",
                AlipaySignature.content(params, Set.of("sign")));
    }

    @Test
    @DisplayName("电脑网站支付的地址：签名用应用公钥验得过，二维码模式带 qr_pay_mode=4，时间是东八区")
    void signsPagePayUrl() {
        String url = client().pagePayUrl(request(), 168);
        Map<String, String> params = query(url);

        assertTrue(url.startsWith("https://openapi-sandbox.dl.alipaydev.com/gateway.do?"));
        assertEquals("alipay.trade.page.pay", params.get("method"));
        assertEquals("2026-10-30 10:00:00", params.get("timestamp"));
        assertEquals("https://kotoba.work/api/pay/alipay/notify", params.get("notify_url"));
        assertTrue(params.get("biz_content").contains("\"qr_pay_mode\":\"4\""));
        assertTrue(params.get("biz_content").contains("\"time_expire\":\"2026-10-30 10:15:00\""));
        assertTrue(params.get("biz_content").contains("\"total_amount\":\"0.99\""));
        assertTrue(AlipaySignature.verify(AlipaySignature.content(params, Set.of("sign")),
                params.get("sign"), app.getPublic()));

        assertFalse(client().pagePayUrl(request(), null).contains("qr_pay_mode"));
    }

    @Test
    @DisplayName("手机网站支付走 QUICK_WAP_WAY，带上中途退出回哪儿")
    void signsWapPayUrl() {
        Map<String, String> params = query(client().wapPayUrl(request(), "https://kotoba.work/library/basics"));
        assertEquals("alipay.trade.wap.pay", params.get("method"));
        assertTrue(params.get("biz_content").contains("QUICK_WAP_WAY"));
        assertTrue(params.get("biz_content").contains("\"quit_url\":\"https://kotoba.work/library/basics\""));
        assertTrue(AlipaySignature.verify(AlipaySignature.content(params, Set.of("sign")),
                params.get("sign"), app.getPublic()));
    }

    @Test
    @DisplayName("异步通知：支付宝私钥签的才认；改了金额、换了 app_id 都不认")
    void verifiesNotify() {
        Map<String, String> notify = new LinkedHashMap<>();
        notify.put("app_id", "2021000000000001");
        notify.put("out_trade_no", "KB20261030100000123456");
        notify.put("trade_no", "2026103022001400000000000001");
        notify.put("trade_status", "TRADE_SUCCESS");
        notify.put("total_amount", "0.99");
        notify.put("sign_type", "RSA2");
        notify.put("sign", AlipaySignature.sign(
                AlipaySignature.content(notify, Set.of("sign", "sign_type")), alipay.getPrivate()));
        assertTrue(client().verifyNotify(notify));

        Map<String, String> tampered = new LinkedHashMap<>(notify);
        tampered.put("total_amount", "0.01");
        assertFalse(client().verifyNotify(tampered));

        Map<String, String> otherApp = new LinkedHashMap<>(notify);
        otherApp.put("app_id", "2021999999999999");
        assertFalse(client().verifyNotify(otherApp));

        Map<String, String> signedByApp = new LinkedHashMap<>(notify);
        signedByApp.put("sign", AlipaySignature.sign(
                AlipaySignature.content(notify, Set.of("sign", "sign_type")), app.getPrivate()));
        assertFalse(client().verifyNotify(signedByApp));
    }

    @Test
    @DisplayName("查单响应：验的是原文那一段，字段里有花括号也抠得对")
    void parsesSignedQueryResponse() {
        String node = "{\"code\":\"10000\",\"msg\":\"Success\",\"buyer_logon_id\":\"a{b}c\\\"}\","
                + "\"out_trade_no\":\"KB1\",\"trade_no\":\"2026T1\",\"trade_status\":\"TRADE_SUCCESS\","
                + "\"total_amount\":\"0.99\"}";
        String body = "{\"alipay_trade_query_response\":" + node + ",\"sign\":\""
                + AlipaySignature.sign(node, alipay.getPrivate()) + "\"}";

        AlipayClient.Trade trade = client().parseQuery(body);
        assertTrue(trade.exists());
        assertTrue(trade.paid());
        assertEquals("2026T1", trade.tradeNo());
        assertEquals("0.99", trade.totalAmount());
    }

    @Test
    @DisplayName("还没扫码的单支付宝那边不存在，算没付；签名不对就报错，不当成没付")
    void handlesMissingTradeAndBadSignature() {
        String missing = "{\"code\":\"40004\",\"msg\":\"Business Failed\",\"sub_code\":\"ACQ.TRADE_NOT_EXIST\","
                + "\"sub_msg\":\"交易不存在\"}";
        AlipayClient.Trade trade = client().parseQuery("{\"alipay_trade_query_response\":" + missing
                + ",\"sign\":\"" + AlipaySignature.sign(missing, alipay.getPrivate()) + "\"}");
        assertFalse(trade.exists());
        assertFalse(trade.paid());

        String forged = "{\"code\":\"10000\",\"trade_status\":\"TRADE_SUCCESS\",\"total_amount\":\"0.99\"}";
        assertThrows(AlipayException.class, () -> client().parseQuery("{\"alipay_trade_query_response\":"
                + forged + ",\"sign\":\"" + AlipaySignature.sign(forged, app.getPrivate()) + "\"}"));
    }

    @Test
    @DisplayName("抠原文：找不到 key 时是 null")
    void rawObjectMissingKey() {
        assertNull(AlipayClient.rawObject("{\"error_response\":{\"code\":\"40002\"}}", "alipay_trade_query_response"));
    }

    private static Map<String, String> query(String url) {
        Map<String, String> params = new HashMap<>();
        for (String pair : URI.create(url).getRawQuery().split("&")) {
            int eq = pair.indexOf('=');
            params.put(pair.substring(0, eq), URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return params;
    }
}
