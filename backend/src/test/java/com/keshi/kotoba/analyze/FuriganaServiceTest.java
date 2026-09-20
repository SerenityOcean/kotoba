package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 注音这件事真正的风险不是注错，是模型顺手把正文改了 —— 那样读者看到的
 * 就不是原文了，而且没人会发现。这里守的就是那道校验。
 */
class FuriganaServiceTest {

    private static FuriganaService serviceReturning(String canned) {
        return new FuriganaService(StubEngine.provide(new StubEngine(text -> canned)));
    }

    @Test
    @DisplayName("只插入了注音，原样收下")
    void acceptsPureAnnotation() {
        FuriganaResult result = serviceReturning("東日本[ひがしにほん]の空[そら]")
                .annotate("東日本の空");

        assertTrue(result.annotated());
        assertEquals("東日本[ひがしにほん]の空[そら]", result.text());
    }

    @Test
    @DisplayName("模型改了正文就退回原文，不能让读者看到被改过的文章")
    void rejectsAlteredText() {
        FuriganaResult result = serviceReturning("東日本[ひがしにほん]の青[あお]い空[そら]")
                .annotate("東日本の空");

        assertFalse(result.annotated());
        assertEquals("東日本の空", result.text());
    }

    @Test
    @DisplayName("模型删字同样退回")
    void rejectsDroppedText() {
        FuriganaResult result = serviceReturning("東日本[ひがしにほん]").annotate("東日本の空");

        assertFalse(result.annotated());
        assertEquals("東日本の空", result.text());
    }

    @Test
    @DisplayName("只是换行变空格这种空白差异不算改动")
    void toleratesWhitespaceDifferences() {
        FuriganaResult result =
                serviceReturning("東日本[ひがしにほん] の 空[そら]").annotate("東日本\nの空");

        assertTrue(result.annotated());
    }

    @Test
    @DisplayName("剥注音只认汉字底字，送り仮名写法错了会被判为改动")
    void stripOnlyMatchesKanjiBase() {
        assertEquals("食べる", FuriganaService.strip("食[た]べる"));
        // 「食べ[たべ]る」底字含假名，剥不掉 —— 于是和原文对不上，被拒
        assertEquals("食べ[たべ]る", FuriganaService.strip("食べ[たべ]る"));
    }

    @Test
    @DisplayName("原文里的括号注音先确定性地转成方括号，不花钱问模型")
    void convertsParenthesisedReadings() {
        assertEquals("価値[かち]や情報[じょうほう]",
                FuriganaService.bracketize("価値（かち）や情報（じょうほう）"));
        // 半角括号同样认
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

    @Test
    @DisplayName("括号注音的原文，模型原样返回也算注音成功")
    void parenthesisedSourceStillEndsUpBracketed() {
        // 模型看到已经是方括号了就原样返回，结果仍然是注好音的
        FuriganaResult result = new FuriganaService(
                StubEngine.provide(new StubEngine(text -> text)))
                .annotate("価値（かち）や情報（じょうほう）");

        assertTrue(result.annotated());
        assertEquals("価値[かち]や情報[じょうほう]", result.text());
    }

    @Test
    @DisplayName("模型改了正文时，确定性的括号转换仍然保留")
    void keepsBracketizationEvenWhenModelIsRejected() {
        FuriganaResult result = serviceReturning("まったく別[べつ]の文[ぶん]")
                .annotate("価値（かち）");

        assertFalse(result.annotated());
        assertEquals("価値[かち]", result.text());
    }

    @Test
    @DisplayName("没配 key 时明确拒掉")
    void withoutEngineIsRejected() {
        FuriganaService service = new FuriganaService(StubEngine.provide(null));

        assertThrows(AnalysisUnavailableException.class, () -> service.annotate("空"));
    }
}
