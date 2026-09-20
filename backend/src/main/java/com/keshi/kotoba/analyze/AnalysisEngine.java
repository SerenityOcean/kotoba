package com.keshi.kotoba.analyze;

/**
 * 把提示词和原文交给某个模型服务，拿回结构化的拆解结果。
 *
 * <p>实现只负责「怎么跟这家的 API 说话」—— 提示词和结果清洗都在
 * {@link AnalyzeService} 那边，换供应商不该动那些。
 */
public interface AnalysisEngine {

    Analysis analyze(String systemPrompt, String text);

    /** 出错文案里用得上，让用户知道是哪家在报错。 */
    String describe();
}
