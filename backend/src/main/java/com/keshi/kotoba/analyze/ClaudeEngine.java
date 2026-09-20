package com.keshi.kotoba.analyze;

import com.anthropic.client.AnthropicClient;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.ThinkingConfigAdaptive;

/**
 * 走 Anthropic 官方 SDK。结构化输出交给 SDK 自己从 {@link Analysis} 推 schema，
 * 不用我们传 —— 所以这里看不到 {@link AnalysisSchema}。
 */
class ClaudeEngine implements AnalysisEngine {

    private final AnthropicClient client;
    private final String model;

    ClaudeEngine(AnthropicClient client, String model) {
        this.client = client;
        this.model = model;
    }

    @Override
    public Analysis analyze(String systemPrompt, String text) {
        StructuredMessageCreateParams<Analysis> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .thinking(ThinkingConfigAdaptive.builder().build())
                .system(systemPrompt)
                .outputConfig(Analysis.class)
                .addUserMessage(text)
                .build();

        try {
            return client.messages().create(params).content().stream()
                    .flatMap(block -> block.text().stream())
                    .findFirst()
                    .map(block -> block.text())
                    .orElseThrow(() -> new AnalysisFailedException("模型没有返回拆解结果", null));
        } catch (RateLimitException e) {
            throw new AnalysisFailedException("请求太频繁了，等一会儿再试", e);
        } catch (AnthropicIoException e) {
            throw new AnalysisFailedException("连不上 Anthropic，检查一下网络", e);
        } catch (AnthropicServiceException e) {
            throw new AnalysisFailedException(
                    "Anthropic 报错：" + UpstreamErrors.readable(e.getMessage()), e);
        }
    }

    @Override
    public String annotate(String systemPrompt, String text) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .thinking(ThinkingConfigAdaptive.builder().build())
                .system(systemPrompt)
                .addUserMessage(text)
                .build();

        try {
            return client.messages().create(params).content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(block -> block.text())
                    .findFirst()
                    .orElseThrow(() -> new AnalysisFailedException("模型没有返回内容", null));
        } catch (RateLimitException e) {
            throw new AnalysisFailedException("请求太频繁了，等一会儿再试", e);
        } catch (AnthropicIoException e) {
            throw new AnalysisFailedException("连不上 Anthropic，检查一下网络", e);
        } catch (AnthropicServiceException e) {
            throw new AnalysisFailedException(
                    "Anthropic 报错：" + UpstreamErrors.readable(e.getMessage()), e);
        }
    }

    @Override
    public String describe() {
        return "Anthropic " + model;
    }
}
