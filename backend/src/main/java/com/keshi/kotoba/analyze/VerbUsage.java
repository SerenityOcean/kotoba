package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record VerbUsage(

        @JsonPropertyDescription("动词在句中出现的原样形式，例如「食べさせられた」")
        String surface,

        @JsonPropertyDescription("辞书形（原形），例如「食べる」")
        String dictionaryForm,

        @JsonPropertyDescription("辞书形的假名读音，例如「たべる」")
        String reading,

        @JsonPropertyDescription("活用的名称，例如「使役被动 + 过去式」「て形 + しまう」「可能形」")
        String form,

        @JsonPropertyDescription("这个形式在这句话里表达什么：为什么用这个活用、语感上的差别，两三句话说清")
        String explanation,

        @JsonPropertyDescription("辞书形的中文意思")
        String meaning
) {
}
