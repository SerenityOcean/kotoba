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
    @DisplayName("没配 key 时明确拒掉")
    void withoutEngineIsRejected() {
        FuriganaService service = new FuriganaService(StubEngine.provide(null));

        assertThrows(AnalysisUnavailableException.class, () -> service.annotate("空"));
    }
}
