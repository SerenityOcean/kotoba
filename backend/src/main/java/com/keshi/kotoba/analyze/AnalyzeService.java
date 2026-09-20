package com.keshi.kotoba.analyze;

import com.anthropic.client.AnthropicClient;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AnalyzeService {

    /**
     * 提示词的一半在这儿，另一半是 {@link Analysis} 那几个 record 上的
     * {@code @JsonPropertyDescription} —— 它们一起变成模型看到的 JSON schema。
     * 改输出格式要两边一起看。
     */
    private static final String SYSTEM_PROMPT = """
            你是日语教学助手，读者是中文母语的日语学习者。把用户粘贴的日语文本拆开讲清楚。

            规则：
            1. 先按句号、问号、感叹号或换行把原文切成句子，逐句处理，保持原顺序。
               original 原样照抄那一句，不要改写、不要补标点。
            2. translation 是自然通顺的中文，不要逐字硬译。
            3. verbs 列出句中每一个活用了的动词和形容词。form 要说清整条活用链，
               比如「使役被动 + 过去式」「て形 + 存续」。原形出现（没活用）的动词不用列。
            4. 「〜てしまう」「〜ておく」这类补助动词结构算语法点，放 grammarPoints，
               不要在 verbs 里重复一遍。
            5. grammarPoints 收句型、惯用表达、助词的非基础用法。は・が・を 这种
               入门就会的基本用法不用列，列了反而吵。
            6. 所有讲解用中文写，日语词句保持日语原样。
            7. 吃不准的地方宁可少写一条，不要编。
            """;

    private final ObjectProvider<AnthropicClient> clientProvider;
    private final String model;

    public AnalyzeService(ObjectProvider<AnthropicClient> clientProvider,
                          @Value("${anthropic.model}") String model) {
        this.clientProvider = clientProvider;
        this.model = model;
    }

    public Analysis analyze(String text) {
        AnthropicClient client = clientProvider.getIfAvailable();
        if (client == null) {
            throw new AnalysisUnavailableException();
        }

        StructuredMessageCreateParams<Analysis> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .thinking(ThinkingConfigAdaptive.builder().build())
                .system(SYSTEM_PROMPT)
                .outputConfig(Analysis.class)
                .addUserMessage(text.strip())
                .build();

        Analysis analysis;
        try {
            analysis = client.messages().create(params).content().stream()
                    .flatMap(block -> block.text().stream())
                    .findFirst()
                    .map(block -> block.text())
                    .orElseThrow(() -> new AnalysisFailedException("模型没有返回拆解结果", null));
        } catch (RateLimitException e) {
            throw new AnalysisFailedException("请求太频繁了，等一会儿再试", e);
        } catch (AnthropicIoException e) {
            throw new AnalysisFailedException("连不上模型服务，检查一下网络", e);
        } catch (AnthropicServiceException e) {
            throw new AnalysisFailedException("模型服务报错：" + e.getMessage(), e);
        }

        // schema 保证不了「数组非空」，下游（前端建卡）按空列表处理更省事
        return new Analysis(analysis.sentences() == null ? List.of() : analysis.sentences());
    }
}
