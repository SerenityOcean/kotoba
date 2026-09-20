package com.keshi.kotoba.analyze;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AnthropicConfig {

    /**
     * 没配 ANTHROPIC_API_KEY 就不建这个 bean —— 应用照常起来，
     * 只是 /api/analyze 回 503，复习和卡片一概不受影响。
     */
    @Bean
    @ConditionalOnExpression("!'${anthropic.api-key:}'.isBlank()")
    AnthropicClient anthropicClient(@Value("${anthropic.api-key}") String apiKey) {
        return AnthropicOkHttpClient.builder().apiKey(apiKey).build();
    }
}
