package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * 一次拆解的完整结果。这个 record（连同它引用的几个）同时是
 * 给模型的 JSON schema —— 字段名和 {@code @JsonPropertyDescription}
 * 就是提示词的一部分，改这里等于改提示词。
 */
public record Analysis(

        @JsonPropertyDescription("按原文顺序切分出的句子，每句一项")
        List<AnalyzedSentence> sentences
) {
}
