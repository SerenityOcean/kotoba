package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record Loanword(

        @JsonPropertyDescription("外来语在句中出现的原样（片假名），例如「アルバイト」「コンピューター」")
        String surface,

        @JsonPropertyDescription("对应的英文。英语来源就写原词（コンピューター → computer）；"
                + "非英语来源或和製英語，写意思对应的英文（アルバイト → part-time job，サラリーマン → office worker）")
        String english,

        @JsonPropertyDescription("来源：英语来源写「英语」；其他语言写语言和原词，例如「德语 Arbeit」；"
                + "和製英語写出它是怎么拼的，例如「和製英語：salary + man」")
        String origin,

        @JsonPropertyDescription("在日语里的中文意思。和英文原词意思有偏差的要点一句，"
                + "例如マンション是公寓，不是英语 mansion 那种豪宅")
        String meaning
) {
}
