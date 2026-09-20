package com.keshi.kotoba.analyze;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;

/**
 * 按 analyze.provider 挑一个引擎。没配对应的 key 就一个都不建 ——
 * 应用照常启动，只是 /api/analyze 回 503，复习和卡片一概不受影响。
 */
@Configuration
public class AnalyzeConfig {

    @Bean
    @ConditionalOnExpression(
            "'${analyze.provider:openai}'.equals('anthropic') && !'${analyze.anthropic.api-key:}'.isBlank()")
    AnalysisEngine claudeEngine(@Value("${analyze.anthropic.api-key}") String apiKey,
                                @Value("${analyze.anthropic.model}") String model) {
        return new ClaudeEngine(
                AnthropicOkHttpClient.builder().apiKey(apiKey).build(), model);
    }

    @Bean
    @ConditionalOnExpression(
            "'${analyze.provider:openai}'.equals('openai')"
                    + " && !'${analyze.openai.api-key:}'.isBlank()"
                    + " && !'${analyze.openai.base-url:}'.isBlank()")
    AnalysisEngine openAiCompatibleEngine(@Value("${analyze.openai.base-url}") String baseUrl,
                                          @Value("${analyze.openai.api-key}") String apiKey,
                                          @Value("${analyze.openai.model}") String model,
                                          @Value("${analyze.openai.timeout-seconds}") long timeoutSeconds,
                                          @Value("${analyze.openai.thinking}") String thinking,
                                          ObjectMapper json) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        // 拆解一段话要想几十秒，默认超时不够用。
        // 但也不能太长：必须小于 nginx 的 proxy_read_timeout，
        // 否则用户看到的是 nginx 的裸 504，而不是这边给出的中文错误。
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));

        RestClient http = RestClient.builder()
                .requestFactory(factory)
                .baseUrl(baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();

        return new OpenAiCompatibleEngine(http, json, model, thinking);
    }
}
