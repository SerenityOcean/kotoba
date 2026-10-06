package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record VerbUsage(

        @JsonPropertyDescription("动词在句中出现的原样形式，汉字注音，例如「食[た]べさせられた」")
        String surface,

        @JsonPropertyDescription("辞书形（原形），例如「食べる」")
        String dictionaryForm,

        @JsonPropertyDescription("辞书形的假名读音，例如「たべる」")
        String reading,

        @JsonPropertyDescription("活用的名称，例如「使役被动 + 过去式」「て形 + しまう」「可能形」；没活用就写「辞书形」")
        String form,

        @JsonPropertyDescription("这个形式在这句话里表达什么：为什么用这个活用、语感上的差别，两三句话说清")
        String explanation,

        @JsonPropertyDescription("辞书形的中文意思")
        String meaning,

        @JsonPropertyDescription("动词写「自动词」「他动词」或「自他两用」；形容词写「い形容词」「な形容词」")
        String transitivity,

        @JsonPropertyDescription("这个词本身怎么用，不限于这句话：常带哪个助词（〜を / 〜に / 〜が），"
                + "典型搭配和固定说法（例如「やむを得ない」「雨[あめ]が止[や]む」），"
                + "有自他对应的写出另一半并说区别（止[や]む ↔ 止[や]める）。两三句话，日语部分汉字注音")
        String usage
) {
}
