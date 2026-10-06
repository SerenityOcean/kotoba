package com.keshi.kotoba.card;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReadingsTest {

    @Test
    @DisplayName("有汉字的短词才考读音；全假名、句子、句型不考")
    void decidesWhichCardsWantReading() {
        assertTrue(Readings.wanted("戻す"));
        assertTrue(Readings.wanted("やむを得[え]ない"));
        assertFalse(Readings.wanted("それでいて"), "全是假名");
        assertFalse(Readings.wanted("それほど〜ない"), "句型");
        assertFalse(Readings.wanted("人[ひと]が働[はたら]くのは収入[しゅうにゅう]を得[え]るためだ。"), "整句");
        assertFalse(Readings.wanted(""));
    }

    @Test
    @DisplayName("正面每个汉字都注了音，就拼出读音")
    void readsFromAnnotatedFront() {
        assertEquals("たべさせられた", Readings.guess("食[た]べさせられた", null));
        assertEquals("ひがしにほん", Readings.guess("東日本[ひがしにほん]", "无关"));
        // 有汉字没注音，拼不全
        assertNull(Readings.fromAnnotated("持[も]ち合わせる"));
    }

    @Test
    @DisplayName("背面开头是读音的（Anki 词汇包），取出来")
    void readsFromBackPrefix() {
        assertEquals("はんだん", Readings.guess("判断", "はんだん 名詞 判断 その場で判断する"));
        assertEquals("ほとんど", Readings.guess("殆ど", "ほとんど　副詞 几乎"));
        assertEquals("もどす", Readings.guess("戻す", "もどす（他动词）还原"));
    }

    @Test
    @DisplayName("背面开头的假名和正面的送り仮名对不上，就不当读音")
    void rejectsBackPrefixThatDoesNotFit() {
        // 戻す 以「す」结尾，「ない」不可能是它的读音
        assertNull(Readings.guess("戻す", "ない 没有"));
        // 背面是中文，开头没有假名
        assertNull(Readings.guess("判断", "判断；判定"));
        assertNull(Readings.guess("判断", null));
    }

    @Test
    @DisplayName("用户填的读音：斜线统一成全角，留空是 null，写了汉字或罗马字报错")
    void normalizesUserInput() {
        assertEquals("きょう／こんにち", Readings.normalize(" きょう / こんにち "));
        assertEquals("ガスだい", Readings.normalize("ガスだい"));
        assertNull(Readings.normalize("  "));
        assertNull(Readings.normalize(null));
        assertThrows(IllegalArgumentException.class, () -> Readings.normalize("modosu"));
        assertThrows(IllegalArgumentException.class, () -> Readings.normalize("戻す"));
    }

    @Test
    @DisplayName("片假名的送り仮名和平假名读音也算对得上")
    void fitsAcrossKanaScripts() {
        assertTrue(Readings.fits("ガス代", "がすだい"));
        assertFalse(Readings.fits("判断", "は"), "读音比汉字还短");
    }
}
