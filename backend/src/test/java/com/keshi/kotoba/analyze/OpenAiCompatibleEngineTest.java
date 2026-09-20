package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * tool_choice 只能是 auto（思考模式的限制），模型有时会把 JSON 写进正文
 * 而不是调函数。这条兜底路径平时不走，坏了也不会有人发现 —— 所以测它。
 */
class OpenAiCompatibleEngineTest {

    @Test
    @DisplayName("正文裹着 ``` 围栏时能把 JSON 抠出来")
    void unwrapsFencedJson() {
        assertEquals("{\"sentences\":[]}",
                OpenAiCompatibleEngine.unwrap("```json\n{\"sentences\":[]}\n```"));
    }

    @Test
    @DisplayName("JSON 前后有废话也能抠出来")
    void unwrapsJsonWithSurroundingProse() {
        assertEquals("{\"a\":1}",
                OpenAiCompatibleEngine.unwrap("好的，结果如下：{\"a\":1} 希望有帮助"));
    }

    @Test
    @DisplayName("纯散文里没有 JSON，返回 null 让调用方报错")
    void returnsNullWhenNoJson() {
        assertNull(OpenAiCompatibleEngine.unwrap("这句话我看不懂"));
        assertNull(OpenAiCompatibleEngine.unwrap(""));
        assertNull(OpenAiCompatibleEngine.unwrap(null));
    }
}
