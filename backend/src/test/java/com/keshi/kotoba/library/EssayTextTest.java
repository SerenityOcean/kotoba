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
    @DisplayName("小小标题、列表、图、粗体斜体：记号不算字，图整行不算")
    void richerMarks() {
        String body = """
                ### 参考
                - **读原版。**
                  《哈利波特》
                1. *斜体*的一条
                ![漫画](/essay-media/a.webp "图：一张漫画")
                """;
        assertEquals("参考\n读原版。\n《哈利波特》\n斜体的一条", EssayText.plain(body));
        assertEquals("读原版。", EssayText.excerpt(body, 100));
    }

    @Test
    @DisplayName("行中间的减号、数字不是列表")
    void dashInsideLineStays() {
        assertEquals("-5 度，2.5 倍", EssayText.plain("-5 度，2.5 倍"));
    }

    @Test
    @DisplayName("读多久：一分钟 400 字，向上取整，最少一分钟")
    void minutes() {
        assertEquals(1, EssayText.minutes(0));
        assertEquals(1, EssayText.minutes(400));
        assertEquals(2, EssayText.minutes(401));
    }
}
