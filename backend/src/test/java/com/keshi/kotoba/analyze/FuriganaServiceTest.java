package com.keshi.kotoba.analyze;

import com.keshi.kotoba.text.FuriganaNotation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 注音这件事最要紧的不是注得多准，是不能动正文 —— 读者看到的必须是原文。
 * 读音准不准在 JapaneseReadingTest 里测。
 */
class FuriganaServiceTest {

    private final FuriganaService service = new FuriganaService();

    @Test
    @DisplayName("剥掉注音和原文一字不差")
    void neverAltersText() {
        String text = "関東地方の太平洋側では、明日の朝まで激しい雨が降るおそれがあります。\n"
                + "気象庁は、土砂災害や川の増水に警戒するよう呼びかけています。";

        String annotated = service.annotate(text).text();

        assertEquals(text, FuriganaNotation.strip(annotated));
        assertEquals("かんとうちほうのたいへいようがわでは、あしたのあさまではげしいあめがふるおそれがあります。\n"
                        + "きしょうちょうは、どしゃさいがいやかわのぞうすいにけいかいするようよびかけています。",
                FuriganaNotation.reading(annotated));
    }

    @Test
    @DisplayName("原文里的括号注音先转成方括号，词典不再动它")
    void keepsAuthorsReadings() {
        // 作者注的是 とうきょう 以外的读法，也照作者的来
        assertEquals("東京[ひがしきょう]へ行[い]く",
                service.annotate("東京（ひがしきょう）へ行く").text());
    }

    @Test
    @DisplayName("括号转方括号：半角全角都认")
    void convertsParenthesisedReadings() {
        assertEquals("価値[かち]や情報[じょうほう]",
                FuriganaService.bracketize("価値（かち）や情報（じょうほう）"));
        assertEquals("東京[とうきょう]", FuriganaService.bracketize("東京(とうきょう)"));
    }

    @Test
    @DisplayName("不是注音的括号原样留着")
    void leavesRealParenthesesAlone() {
        // 括号里是汉字，那是正经的括号内容不是读音
        assertEquals("東京（首都）", FuriganaService.bracketize("東京（首都）"));
        // 前面不是汉字，不构成注音
        assertEquals("これ（それ）", FuriganaService.bracketize("これ（それ）"));
    }
}
