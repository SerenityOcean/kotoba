package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/**
 * 走 OpenAI 兼容的 /chat/completions —— 百炼（通义）、DeepSeek、智谱都是这一套，
 * 区别只在 base-url 和 model。
 *
 * <p>结构化输出用 tool calling 而不是 response_format：后者各家支持程度不一，
 * 而带 schema 的函数调用是这几家文档里都写明的。schema 从 {@link AnalysisSchema}
 * 来，和 Anthropic 那条路共用同一份 record 推导。
 */
class OpenAiCompatibleEngine implements AnalysisEngine {

    private static final String TOOL_NAME = "submit_analysis";

    private final RestClient http;
    private final ObjectMapper json;
    private final String model;

    OpenAiCompatibleEngine(RestClient http, ObjectMapper json, String model) {
        this.http = http;
        this.json = json;
        this.model = model;
    }

    @Override
    public Analysis analyze(String systemPrompt, String text) {
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", text)),
                "tools", List.of(Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", TOOL_NAME,
                                "description", "提交这段日语的拆解结果",
                                "parameters", schemaNode()))),
                // 逼它必须走这个函数，别自由发挥回一段散文
                "tool_choice", Map.of(
                        "type", "function",
                        "function", Map.of("name", TOOL_NAME)));

        ChatResponse response;
        try {
            response = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ChatResponse.class);
        } catch (RestClientResponseException e) {
            throw new AnalysisFailedException(
                    "模型服务报错：" + UpstreamErrors.readable(e.getResponseBodyAsString()), e);
        } catch (ResourceAccessException e) {
            throw new AnalysisFailedException("连不上模型服务，检查一下网络和 base-url", e);
        }

        return parse(extractArguments(response));
    }

    private JsonNode schemaNode() {
        return json.readTree(AnalysisSchema.asJson());
    }

    /**
     * 正常情况下结果在 tool_calls 里。有的服务偶尔会无视 tool_choice、
     * 把 JSON 直接写进 content，所以兜一下底再放弃。
     */
    private String extractArguments(ChatResponse response) {
        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new AnalysisFailedException("模型没有返回任何结果", null);
        }
        ChatMessage message = response.choices().getFirst().message();
        if (message == null) {
            throw new AnalysisFailedException("模型没有返回任何结果", null);
        }

        if (message.toolCalls() != null && !message.toolCalls().isEmpty()) {
            ToolCall call = message.toolCalls().getFirst();
            if (call.function() != null && call.function().arguments() != null) {
                return call.function().arguments();
            }
        }
        if (message.content() != null && !message.content().isBlank()) {
            return message.content();
        }
        throw new AnalysisFailedException("模型没有按要求返回结构化结果", null);
    }

    private Analysis parse(String arguments) {
        try {
            return json.readValue(arguments, Analysis.class);
        } catch (JacksonException e) {
            throw new AnalysisFailedException("模型返回的结果看不懂，可能被截断了", e);
        }
    }

    @Override
    public String describe() {
        return model;
    }

    // ---- 响应体。字段远比这些多，只挑用得上的 ----

    record ChatResponse(List<Choice> choices) {
    }

    record Choice(ChatMessage message) {
    }

    record ChatMessage(String content, @JsonProperty("tool_calls") List<ToolCall> toolCalls) {
    }

    record ToolCall(FunctionCall function) {
    }

    record FunctionCall(String name, String arguments) {
    }
}
