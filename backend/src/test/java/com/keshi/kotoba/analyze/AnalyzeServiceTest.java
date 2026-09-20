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
    @DisplayName("原文两头的空白在送给模型前去掉")
    void textIsStrippedBeforeReachingEngine() {
        StubEngine engine = new StubEngine(new Analysis(List.of()));
        new AnalyzeService(StubEngine.provide(engine)).analyze("  勉強する\n  ");

        assertEquals("勉強する", engine.lastText);
        assertTrue(engine.lastPrompt.contains("日语教学助手"));
    }
}
