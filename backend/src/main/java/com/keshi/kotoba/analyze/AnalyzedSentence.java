package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

public record AnalyzedSentence(

        @JsonPropertyDescription("这一句的日语原文，照抄不要改写，但汉字要按方括号记法注音，例如「東日本[ひがしにほん]の太平洋[たいへいよう]側[がわ]」")
        String original,

        @JsonPropertyDescription("整句的中文翻译，要自然通顺，不要逐字直译")
        String translation,

        @JsonPropertyDescription("句中出现的动词和形容词，包括没活用的原形，每个一项。没有就给空数组")
        List<VerbUsage> verbs,

        @JsonPropertyDescription("句中出现的外来语（片假名词），每个一项。人名、地名不算。没有就给空数组")
        List<Loanword> loanwords,

        @JsonPropertyDescription("句中出现的语法点/句型，每个一项。没有就给空数组")
        List<GrammarPoint> grammarPoints
) {
}
