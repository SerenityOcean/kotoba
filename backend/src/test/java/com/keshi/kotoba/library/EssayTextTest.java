package com.keshi.kotoba.library;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EssayTextTest {

    private static final String BODY = """
            ## 一开始

            我背过三遍五十音[^1]，每次都在第三周放弃。

            ::: 例
            雨[あめ]が止[や]んだら、散歩[さんぽ]に行[い]きましょう。
            雨停了的话，去散步吧。
            :::

            > 不是每个生词都值得记。

            [^1]: 平假名和片假名各一遍。
            """;

    @Test
    @DisplayName("纯文字：去掉小标题、引文、例句围栏、旁注和注音")
    void plain() {
        String plain = EssayText.plain(BODY);
        assertEquals(false, plain.contains("##"));
        assertEquals(false, plain.contains("[^1]"));
        assertEquals(false, plain.contains(":::"));
        assertEquals(false, plain.contains("平假名和片假名"));
        assertEquals(true, plain.contains("雨が止んだら"));
        assertEquals(true, plain.contains("不是每个生词都值得记"));
    }

    @Test
    @DisplayName("摘要从第一段正文开始，跳过开头的小标题；太长就截断")
    void excerpt() {
        assertEquals("我背过三遍五十音，每次都在第三周放弃。", EssayText.excerpt(BODY, 100));
        assertEquals("我背过三遍…", EssayText.excerpt(BODY, 5));
    }

    @Test
    @DisplayName("一行一段：摘要只取第一行，不把下一段带进来；例句块里的行不算")
    void excerptTakesFirstLine() {
        assertEquals("第一段。", EssayText.excerpt("第一段。\n第二段。", 100));
        assertEquals("例句后面那段。", EssayText.excerpt("::: 例\n雨[あめ]。\n:::\n例句后面那段。", 100));
    }

    @Test
    @DisplayName("读多久：一分钟 400 字，向上取整，最少一分钟")
    void minutes() {
        assertEquals(1, EssayText.minutes(0));
        assertEquals(1, EssayText.minutes(400));
        assertEquals(2, EssayText.minutes(401));
    }
}
