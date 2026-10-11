package com.keshi.kotoba.analyze;

import org.springframework.beans.factory.ObjectProvider;

/** 测试用的假引擎：analyze 回事先摆好的结果。 */
class StubEngine implements AnalysisEngine {

    private final Analysis result;

    String lastPrompt;
    String lastText;

    StubEngine(Analysis result) {
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

    /** 容器里没配 key 时就是 null，getIfAvailable() 回 null。 */
    static ObjectProvider<AnalysisEngine> provide(AnalysisEngine engine) {
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
}
