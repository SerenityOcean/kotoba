package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * tool_choice 只能是 auto（思考模式的限制），模型有时会把 JSON 写进正文
 * 而不是调函数。这条兜底路径平时不走，坏了也不会有人发现 —— 所以测它。
 */
class OpenAiCompatibleEngineTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode unwrap(String raw) {
        return new OpenAiCompatibleEngine(null, JSON, "test")
                .unwrapDoubleEncoded(JSON.readTree(raw));
    }

    @Test
    @DisplayName("sentences 被当成字符串返回时，再解一层")
    void unwrapsStringifiedSentences() {
        JsonNode node = unwrap("{\"sentences\":\"[{\\\"original\\\":\\\"空\\\"}]\"}");

        assertTrue(node.get("sentences").isArray(), "sentences 应该被解成数组");
        assertEquals("空", node.get("sentences").get(0).get("original").stringValue());
    }

    @Test
    @DisplayName("整个对象被包成字符串时，也能解开")
    void unwrapsStringifiedRoot() {
        JsonNode node = unwrap("\"{\\\"sentences\\\":[]}\"");

        assertTrue(node.isObject());
        assertTrue(node.get("sentences").isArray());
    }

    @Test
    @DisplayName("本来就是正常结构的，原样放过")
    void leavesWellFormedAlone() {
        JsonNode node = unwrap("{\"sentences\":[{\"original\":\"空\"}]}");

        assertEquals("空", node.get("sentences").get(0).get("original").stringValue());
    }

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
