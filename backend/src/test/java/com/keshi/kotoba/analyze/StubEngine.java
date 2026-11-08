package com.keshi.kotoba.analyze;

import org.springframework.beans.factory.ObjectProvider;

/** 测试用的假引擎：按顺序回事先摆好的结果，摆的用完了就一直回最后那个。 */
public class StubEngine implements AnalysisEngine {

    private final Object[] results;

    public String lastPrompt;
    public String lastText;
    public int calls;

    public StubEngine(Object... results) {
        this.results = results;
    }

    @Override
    public <T> T generate(String systemPrompt, String text, Class<T> type) {
        this.lastPrompt = systemPrompt;
        this.lastText = text;
        Object result = results[Math.min(calls, results.length - 1)];
        calls++;
        return type.cast(result);
    }

    @Override
    public String describe() {
        return "stub";
    }

    /** 容器里没配 key 时就是 null，getIfAvailable() 回 null。 */
    public static ObjectProvider<AnalysisEngine> provide(AnalysisEngine engine) {
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
