package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnalyzeServiceTest {

    @Test
    @DisplayName("没配 key 时拆解请求被明确拒掉，而不是抛 NPE")
    void withoutEngineAnalyzeIsRejected() {
        AnalyzeService service = new AnalyzeService(StubEngine.provide(null));

        assertThrows(AnalysisUnavailableException.class, () -> service.analyze("勉強する"));
    }

    @Test
    @DisplayName("模型回了 null 数组时收敛成空列表，前端不用防")
    void nullSentencesBecomeEmptyList() {
        AnalyzeService service =
                new AnalyzeService(StubEngine.provide(new StubEngine(new Analysis(null))));

        assertEquals(List.of(), service.analyze("勉強する").sentences());
    }

    @Test
    @DisplayName("句子里的 null 列表收敛成空列表")
    void nullListsInSentenceBecomeEmpty() {
        AnalyzedSentence tidy = AnalyzeService.tidy(
                new AnalyzedSentence("空", "空", null, null, null, null));

        assertEquals(List.of(), tidy.verbs());
        assertEquals(List.of(), tidy.words());
        assertEquals(List.of(), tidy.loanwords());
        assertEquals(List.of(), tidy.grammarPoints());
    }

    @Test
    @DisplayName("外来语、带する的动词已经讲过的词，名词那栏不再列一遍")
    void dropsWordsCoveredElsewhere() {
        AnalyzedSentence sentence = new AnalyzedSentence("このジャムを売店でも販売したい", "",
                List.of(new VerbUsage("販売[はんばい]したい", "販売[はんばい]する", "はんばいする",
                        "", "", "", "", "")),
                List.of(word("ジャム"), word("売店[ばいてん]"), word("販売[はんばい]")),
                List.of(new Loanword("ジャム", "jam", "英语", "果酱")),
                List.of());

        assertEquals(List.of("売店[ばいてん]"),
                AnalyzeService.tidy(sentence).words().stream().map(Word::surface).toList());
    }

    private static Word word(String surface) {
        return new Word(surface, "", "名词", "", "");
    }

    @Test
    @DisplayName("原文两头的空白在送给模型前去掉")
    void textIsStrippedBeforeReachingEngine() {
        StubEngine engine = new StubEngine(new Analysis(List.of()));
        new AnalyzeService(StubEngine.provide(engine)).analyze("  勉強する\n  ");

        assertEquals("勉強する", engine.lastText);
        assertTrue(engine.lastPrompt.contains("日语教学助手"));
    }
}
