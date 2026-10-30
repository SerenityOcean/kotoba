package com.keshi.kotoba.pay;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;

/**
 * 三样钥匙都配了才建 {@link AlipayClient}。没配的话应用照常启动，资料包页上不出现「用支付宝解锁」，
 * 兑换码照样能用 —— 和没配模型 key 时拆解关掉、别的不受影响是一个意思。
 */
@Configuration
public class AlipayConfig {

    @Bean
    @ConditionalOnExpression("!'${pay.alipay.app-id:}'.isBlank()"
            + " && !'${pay.alipay.private-key:}'.isBlank()"
            + " && !'${pay.alipay.alipay-public-key:}'.isBlank()")
    AlipayClient alipayClient(@Value("${pay.alipay.gateway}") String gateway,
                              @Value("${pay.alipay.app-id}") String appId,
                              @Value("${pay.alipay.private-key}") String privateKey,
                              @Value("${pay.alipay.alipay-public-key}") String alipayPublicKey,
                              @Value("${app.base-url}") String baseUrl,
                              ObjectMapper json,
                              Clock clock) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        // 查单是前端轮询时顺手查的，慢了宁可这一轮不查，下一轮再来
        factory.setReadTimeout(Duration.ofSeconds(8));

        return new AlipayClient(gateway.strip(), appId.strip(),
                AlipaySignature.privateKey(privateKey), AlipaySignature.publicKey(alipayPublicKey),
                baseUrl + "/api/pay/alipay/notify",
                RestClient.builder().requestFactory(factory).build(), json, clock);
    }
}
