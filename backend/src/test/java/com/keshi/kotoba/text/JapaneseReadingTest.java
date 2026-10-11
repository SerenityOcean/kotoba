package com.keshi.kotoba.text;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JapaneseReadingTest {

    private static String reading(String text) {
        return FuriganaNotation.reading(JapaneseReading.annotate(text));
    }

    @Test
    @DisplayName("送り仮名留在方括号外面，只给汉字段注音")
    void keepsOkuriganaOutside() {
        assertEquals("食[た]べる", JapaneseReading.annotate("食べる"));
        assertEquals("取[と]り消[け]す", JapaneseReading.annotate("取り消す"));
        assertEquals("図書館[としょかん]で勉強[べんきょう]する",
                JapaneseReading.annotate("図書館で勉強する"));
    }

    @Test
    @DisplayName("全假名、空串原样返回")
    void leavesKanaAlone() {
        assertEquals("ありがとう、コーヒー", JapaneseReading.annotate("ありがとう、コーヒー"));
        assertEquals("", JapaneseReading.annotate(""));
    }

    @Test
    @DisplayName("已经注了音的不动，只补没注的")
    void keepsExistingAnnotations() {
        // 作者注的读法优先，哪怕和词典不一样
        assertEquals("今日[こんにち]は良[よ]い天気[てんき]",
                JapaneseReading.annotate("今日[こんにち]は良い天気"));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("数字 + 量词的特殊读法")
    @CsvSource({
            "一人, ひとり",
            "二人, ふたり",
            "三人, さんにん",
            "四人, よにん",
            "十一人, じゅういちにん",
            "十四人, じゅうよにん",
            "二日, ふつか",
            "十日, とおか",
            "二十日, はつか",
            "十四日, じゅうよっか",
            "二十歳, はたち",
            "四時, よじ",
            "九時, くじ",
            "七時半, しちじはん",
            "六時半, ろくじはん",
            "一口, ひとくち",
    })
    void specialCounterReadings(String text, String expected) {
        assertEquals(expected, reading(text));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("数字 + 量词的促音化、浊化")
    @CsvSource({
            "一回, いっかい",
            "六回, ろっかい",
            "十一回, じゅういっかい",
            "三階, さんがい",
            "一週間, いっしゅうかん",
            "八歳, はっさい",
            "六冊, ろくさつ",
            "一杯, いっぱい",
            "三杯, さんばい",
            "四杯, よんはい",
            "六本, ろっぽん",
            "三本, さんぼん",
            "何本, なんぼん",
            "二十本, にじゅっぽん",
            "一分, いっぷん",
            "三分, さんぷん",
            "五分, ごふん",
            "十分間, じゅっぷんかん",
            "一か月, いっかげつ",
            "一度, いちど",
    })
    void soundChanges(String text, String expected) {
        assertEquals(expected, reading(text));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("数字内部的音变")
    @CsvSource({
            "三百円, さんびゃくえん",
            "六百, ろっぴゃく",
            "八百, はっぴゃく",
            "三千, さんぜん",
            "八千, はっせん",
    })
    void numberSoundChanges(String text, String expected) {
        assertEquals(expected, reading(text));
    }

    @Test
    @DisplayName("量词规则只管紧跟在数字后面的，不是数字的「一」不受影响")
    void onlyNumbersBeforeCounters() {
        assertEquals("いっしょ", reading("一緒"));
        assertEquals("いちばん", reading("一番"));
        assertEquals("いっぱん", reading("一般"));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("词典里已知的错读")
    @CsvSource({
            "預ける, あずける",
            "荷物を預けてから, にもつをあずけてから",
            "入り口, いりぐち",
            "出口, でぐち",
            "夜中に目が覚めた, よなかにめがさめた",
            "日本の料理, にほんのりょうり",
            "日本人, にほんじん",
            "日本語, にほんご",
            "洗濯物を干す, せんたくものをほす",
            "宝物, たからもの",
    })
    void fixesKnownMisreads(String text, String expected) {
        assertEquals(expected, reading(text));
    }

    @Test
    @DisplayName("片假名转平假名，长音不动")
    void convertsKatakana() {
        assertEquals("こーひーをのむ", JapaneseReading.toHiragana("コーヒーヲノム"));
    }
}
