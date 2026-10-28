package com.keshi.kotoba.exam;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * 一道题的解析，由模型按这几个 record 推出的 schema 写。
 * 和拆解一样，{@code @JsonPropertyDescription} 是提示词的一部分，提示词另一半在
 * {@link ExplanationService}。
 */
public record QuestionExplanation(

        @JsonPropertyDescription("这题考什么，一句话，例如「漢字読み：行事的读音」「文法：〜すぎて〜ない」「读解：笔者对○○的看法」")
        String point,

        @JsonPropertyDescription("为什么选正确答案，2–4 句中文。读解题指出本文里哪一句是依据；"
                + "语法题讲接续和意思；词汇题讲词义和搭配")
        String reason,

        @JsonPropertyDescription("每个选项一项，按选项顺序，一个不漏")
        List<Choice> choices
) {

    public record Choice(

            @JsonPropertyDescription("选项序号，从 1 数")
            int number,

            @JsonPropertyDescription("这个选项本身是什么意思。读音选项：对应哪个词（写出汉字和中文意思），"
                    + "或者说明根本没有这个读法；词语、语法选项：读音、中文意思、常见接续或搭配；"
                    + "读解题的句子选项：用中文概括它在说什么")
            String meaning,

            @JsonPropertyDescription("放进这道题为什么对、为什么不对，一两句中文")
            String verdict
    ) {
    }
}
