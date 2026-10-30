package com.keshi.kotoba.library;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 支付宝的异步通知：付款成功后支付宝的服务器 POST 过来一张表单。
 * 不登录、不带 CSRF 令牌（SecurityConfig 里单独放行），是不是支付宝发的全靠验签。
 * 回的必须是纯文本 success，否则支付宝会在之后的 24 小时里一遍遍重发。
 */
@RestController
public class AlipayNotifyController {

    private final OrderService orders;

    public AlipayNotifyController(OrderService orders) {
        this.orders = orders;
    }

    @PostMapping(value = "/api/pay/alipay/notify", produces = MediaType.TEXT_PLAIN_VALUE)
    public String notify(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        request.getParameterMap().forEach((name, values) -> params.put(name, values.length > 0 ? values[0] : null));
        return orders.onNotify(params, Instant.now()) ? "success" : "failure";
    }
}
