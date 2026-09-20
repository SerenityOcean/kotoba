package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
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

    /** 输出上限。拆解一句话的 JSON 加上思考过程，几千 token 是常态。 */
    private static final long MAX_TOKENS = 8192;

    /**
     * 思考模式下不让强制 tool_choice（qwen3 会直接回 400），所以只能用 auto
     * 再在提示词里点名。思考对语法分析是有用的，不值得为了强制调用关掉它。
     */
    private static final String TOOL_INSTRUCTION =
            "\n\n把拆解结果通过 " + TOOL_NAME + " 函数提交，不要用普通文字回答。";

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
                // 不给的话用服务端默认值，而思考模式的 token 也算在里面 ——
                // 拆解的 JSON 本来就长，很容易被截断成半句
                "max_tokens", MAX_TOKENS,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt + TOOL_INSTRUCTION),
                        Map.of("role", "user", "content", text)),
                "tools", List.of(Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", TOOL_NAME,
                                "description", "提交这段日语的拆解结果",
                                "parameters", schemaNode()))),
                // 只能是 auto：思考模式下传对象或 "required" 会被拒。
                // 真没调函数的话，下面 extractArguments 还会从正文里捞一次
                "tool_choice", "auto");

        return parse(extractArguments(post(body)));
    }

    @Override
    public String annotate(String systemPrompt, String text) {
        Map<String, Object> body = Map.of(
                "model", model,
                "max_tokens", MAX_TOKENS,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", text)));

        ChatResponse response = post(body);
        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new AnalysisFailedException("模型没有返回任何结果", null);
        }
        ChatMessage message = response.choices().getFirst().message();
        if (message == null || message.content() == null || message.content().isBlank()) {
            throw new AnalysisFailedException("模型没有返回内容", null);
        }
        return message.content();
    }

    private ChatResponse post(Map<String, Object> body) {
        try {
            return http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ChatResponse.class);
        } catch (RestClientResponseException e) {
            throw new AnalysisFailedException(
                    "模型服务报错：" + UpstreamErrors.readable(e.getResponseBodyAsString()), e);
        } catch (ResourceAccessException e) {
            // 把底层原因带出来 —— DNS 没解析出来、连接被重置、读超时，
            // 三种情况处理方式完全不同，笼统一句「连不上」等于没说
            throw new AnalysisFailedException(
                    "连不上模型服务：" + e.getMostSpecificCause() + "（base-url 和网络都查一下）", e);
        }
    }

    private JsonNode schemaNode() {
        return json.readTree(AnalysisSchema.asJson());
    }

    /**
     * 正常情况下结果在 tool_calls 里。但 tool_choice 只能是 auto，模型有时
     * 会把 JSON 直接写进 content —— 兜一下底再放弃，比让用户白等一次强。
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
        String json = unwrap(message.content());
        if (json != null) {
            return json;
        }
        throw new AnalysisFailedException("模型没有按要求返回结构化结果", null);
    }

    /**
     * 有的服务会把嵌套结构再序列化一层塞回来：整个对象是个 JSON 字符串，
     * 或者 sentences 的值是字符串而不是数组。碰上了就再解一层，
     * 比让整次拆解白跑一趟强。
     */
    JsonNode unwrapDoubleEncoded(JsonNode node) {
        JsonNode root = node;
        // 整体被包成字符串：最多解两层，再多就不是这个毛病了
        for (int i = 0; i < 2 && root.isString(); i++) {
            root = json.readTree(root.stringValue());
        }
        if (root.isObject()) {
            JsonNode sentences = root.get("sentences");
            if (sentences != null && sentences.isString()) {
                ((ObjectNode) root).set("sentences", json.readTree(sentences.stringValue()));
            }
        }
        return root;
    }

    /** 正文里的 JSON 常裹着 ```json 围栏或前后带一段废话，把花括号那段抠出来。 */
    static String unwrap(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        return start >= 0 && end > start ? content.substring(start, end + 1) : null;
    }

    private Analysis parse(String arguments) {
        try {
            return json.treeToValue(unwrapDoubleEncoded(json.readTree(arguments)), Analysis.class);
        } catch (JacksonException e) {
            // 带上原因和长度：截断和格式不对是两回事，光说「看不懂」没法排查
            throw new AnalysisFailedException(
                    "模型返回的结果解析不了（" + arguments.length() + " 字符）："
                            + e.getOriginalMessage(), e);
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
