package com.keshi.kotoba.analyze;

/**
 * 把提示词和原文交给某个模型服务，拿回结构化的结果。
 *
 * <p>实现只负责「怎么跟这家的 API 说话」—— 提示词和结果清洗在调用方
 * （{@link AnalyzeService}、应试的解析），换供应商不该动那些。
 */
public interface AnalysisEngine {

    /**
     * 按 type 那几个 record 推出的 schema 要结果。record 上的
     * {@code @JsonPropertyDescription} 是提示词的一部分。
     */
    <T> T generate(String systemPrompt, String text, Class<T> type);

    default Analysis analyze(String systemPrompt, String text) {
        return generate(systemPrompt, text, Analysis.class);
    }

    /** 出错文案里用得上，让用户知道是哪家在报错。 */
    String describe();
}
