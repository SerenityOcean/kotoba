package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/** 动词、形容词、外来语以外的词：名词、副词这些。读者攒词汇主要靠这一栏。 */
public record Word(

        @JsonPropertyDescription("词在句中出现的样子，汉字注音，例如「お客様[きゃくさま]」「名産[めいさん]」「たびたび」")
        String surface,

        @JsonPropertyDescription("假名读音，例如「おきゃくさま」")
        String reading,

        @JsonPropertyDescription("词性：「名词」「サ变名词」（能加する当动词用的）「副词」「连体词」「接续词」之类")
        String partOfSpeech,

        @JsonPropertyDescription("中文意思")
        String meaning,

        @JsonPropertyDescription("值得一提的用法，一两句话：常见搭配（例如「質問[しつもん]を受[う]ける」），"
                + "お・ご 开头的美化语、敬语说明一下，和中文同形词意思不一样的要点出来"
                + "（例如「勉強[べんきょう]」是学习，不是勉强）。没什么好说的写空串，日语部分汉字注音")
        String note
) {
}
