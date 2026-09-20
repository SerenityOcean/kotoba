package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnalyzeServiceTest {

    /** 没配 key 时容器里一个引擎都没有，getIfAvailable() 回 null。 */
    private static ObjectProvider<AnalysisEngine> provide(AnalysisEngine engine) {
        return new ObjectProvider<>() {
            @Override
            public AnalysisEngine getIfAvailable() {
                return engine;
            }

            @Override
            public AnalysisEngine getObject() {
                throw new UnsupportedOperationException();
            }

            @Override
            public AnalysisEngine getObject(Object... args) {
                throw new UnsupportedOperationException();
            }

            @Override
            public AnalysisEngine getIfUnique() {
                return engine;
            }
        };
    }

    @Test
    @DisplayName("没配 key 时拆解请求被明确拒掉，而不是抛 NPE")
    void withoutEngineAnalyzeIsRejected() {
        AnalyzeService service = new AnalyzeService(provide(null));

        assertThrows(AnalysisUnavailableException.class, () -> service.analyze("勉強する"));
    }

    @Test
    @DisplayName("模型回了 null 数组时收敛成空列表，前端不用防")
    void nullSentencesBecomeEmptyList() {
        AnalyzeService service = new AnalyzeService(provide(new StubEngine(new Analysis(null))));

        assertEquals(List.of(), service.analyze("勉強する").sentences());
    }

    @Test
    @DisplayName("原文两头的空白在送给模型前去掉")
    void textIsStrippedBeforeReachingEngine() {
        StubEngine engine = new StubEngine(new Analysis(List.of()));
        new AnalyzeService(provide(engine)).analyze("  勉強する\n  ");

        assertEquals("勉強する", engine.lastText);
        assertTrue(engine.lastPrompt.contains("日语教学助手"));
    }

    private static final class StubEngine implements AnalysisEngine {
        private final Analysis result;
        private String lastPrompt;
        private String lastText;

        private StubEngine(Analysis result) {
            this.result = result;
        }

        @Override
        public Analysis analyze(String systemPrompt, String text) {
            this.lastPrompt = systemPrompt;
            this.lastText = text;
            return result;
        }

        @Override
        public String describe() {
            return "stub";
        }
    }
}
