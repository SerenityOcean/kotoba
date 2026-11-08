package com.keshi.kotoba.exam;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * 一道题的解析，由模型按这几个 record 推出的 schema 写。
 * 和拆解一样，{@code @JsonPropertyDescription} 是提示词的一部分，提示词另一半在
 * {@link ExplanationService}。
 *
 * <p>例句挂在每个选项上，错误选项也有。之前存下的解析例句在最外层（只给正解造了一句），
 * 读的时候不认那两个字段，按「选项上没有例句」重新生成。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuestionExplanation(

        @JsonPropertyDescription("这题考什么，一句话，例如「漢字読み：行事的读音」「文法：〜すぎて〜ない」「读解：笔者对○○的看法」")
        String point,

        @JsonPropertyDescription("为什么选正确答案，2–4 句中文。读解题指出本文里哪一句是依据；"
                + "语法题讲接续和意思；词汇题讲词义和搭配")
        String reason,

        @JsonPropertyDescription("每个选项一项，按选项顺序，一个不漏")
        List<Choice> choices
) {

    /** 选项上没有例句字段：是每个选项都带例句之前生成的，要重新生成 */
    @JsonIgnore
    public boolean predatesChoiceExamples() {
        return choices != null && choices.stream().anyMatch(c -> c.example() == null);
    }

    public record Choice(

            @JsonPropertyDescription("选项序号，从 1 数")
            int number,

            @JsonPropertyDescription("这个选项本身是什么意思。读音选项：对应哪个词（写出汉字和中文意思），"
                    + "或者说明根本没有这个读法；词语、语法选项：读音、中文意思、常见接续或搭配；"
                    + "读解题的句子选项：用中文概括它在说什么")
            String meaning,

            @JsonPropertyDescription("放进这道题为什么对、为什么不对，一两句中文")
            String verdict,

            @JsonPropertyDescription("用这个选项的词或句型新造一个日语例句，一句，N2 难度，不要照搬题目原句，也不要注音。"
                    + "错误选项也要造：读音选项用它对应的那个词（写汉字）造句。"
                    + "选项不是真实存在的词或读法、或者是读解题的内容概括，造不出例句，写空串")
            String example,

            @JsonPropertyDescription("example 的中文翻译，自然通顺；example 是空串这里也写空串")
            String exampleTranslation
    ) {
    }
}
