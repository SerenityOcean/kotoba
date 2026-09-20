package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record GrammarPoint(

        @JsonPropertyDescription("语法点/句型本身，例如「〜てしまう」「〜ば〜ほど」")
        String pattern,

        @JsonPropertyDescription("这个句型的中文含义，一句话")
        String meaning,

        @JsonPropertyDescription("接续规则和用法说明：接在什么形式后面、什么场合用、和近义句型的区别")
        String explanation,

        @JsonPropertyDescription("一个额外的例句（日语原文 + 中文翻译），日语部分的汉字要注音，不要用原文里那句")
        String example
) {
}
