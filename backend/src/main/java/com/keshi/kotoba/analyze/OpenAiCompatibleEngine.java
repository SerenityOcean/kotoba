package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 走 OpenAI 兼容的 /chat/completions —— 百炼（通义）、DeepSeek、智谱都是这一套，
 * 区别只在 base-url 和 model。
 *
 * <p>结构化输出用 tool calling 而不是 response_format：后者各家支持程度不一，
 * 而带 schema 的函数调用是这几家文档里都写明的。schema 从 {@link AnalysisSchema}
 * 来，和 Anthropic 那条路共用同一份 record 推导。拆解和应试的解析都走这里，
 * 区别只在结果的 record。
 */
class OpenAiCompatibleEngine implements AnalysisEngine {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleEngine.class);

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
    /** "true"/"false" 显式开关思考模式，空串表示这个字段不发，用服务端默认。 */
    private final String thinking;
    private final ThinkingSwitch thinkingSwitch;

    OpenAiCompatibleEngine(RestClient http, ObjectMapper json, String model, String thinking,
                           ThinkingSwitch thinkingSwitch) {
        this.http = http;
        this.json = json;
        this.model = model;
        this.thinking = thinking;
        this.thinkingSwitch = thinkingSwitch;
    }

    /**
     * 开关思考模式的字段各家不一样，发错了要么报错要么被无视。
     * DeepSeek 默认是开着的，不显式关掉就又慢又多花输出 token。
     */
    enum ThinkingSwitch {
        /** 百炼（qwen）：{"enable_thinking": false} */
        QWEN,
        /** DeepSeek：{"thinking": {"type": "disabled"}} */
        DEEPSEEK;

        static ThinkingSwitch forBaseUrl(String baseUrl) {
            return baseUrl.contains("deepseek.com") ? DEEPSEEK : QWEN;
        }

        void apply(Map<String, Object> body, boolean on) {
            switch (this) {
                case QWEN -> body.put("enable_thinking", on);
                case DEEPSEEK -> body.put("thinking", Map.of("type", on ? "enabled" : "disabled"));
            }
        }
    }

    /** 思考关掉时才能强制指定函数 —— 开着的话 qwen 会直接回 400。 */
    private boolean thinkingOff() {
        return "false".equals(thinking);
    }

    private Map<String, Object> baseBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        // 不给的话用服务端默认值，而思考模式的 token 也算在里面 ——
        // 拆解的 JSON 本来就长，很容易被截断成半句
        body.put("max_tokens", MAX_TOKENS);
        if (!thinking.isBlank()) {
            thinkingSwitch.apply(body, Boolean.parseBoolean(thinking));
        }
        return body;
    }

    @Override
    public <T> T generate(String systemPrompt, String text, Class<T> type) {
        Map<String, Object> body = baseBody();
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt + TOOL_INSTRUCTION),
                Map.of("role", "user", "content", text)));
        body.put("tools", List.of(Map.of(
                "type", "function",
                "function", Map.of(
                        "name", TOOL_NAME,
                        "description", "提交结果",
                        "parameters", schemaNode(type)))));
        // 思考关掉了就强制走这个函数，结构最稳；开着只能用 auto，
        // 靠提示词点名 + 从正文里捞 JSON 兜底
        body.put("tool_choice", thinkingOff()
                ? Map.of("type", "function", "function", Map.of("name", TOOL_NAME))
                : "auto");

        return parse(extractArguments(post(body)), type);
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

    private JsonNode schemaNode(Class<?> type) {
        return json.readTree(AnalysisSchema.asJson(type));
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

    /**
     * 读第一个完整的 JSON 值，后面多出来的东西不管。
     *
     * <p>模型偶尔会在完整的对象后面多吐一个 {@code }} —— 对象本身一个字不差，
     * 但 Jackson 3 默认把尾巴上多余的符号当错误，整次拆解就白跑了。
     * 中间少括号、多括号这种真坏了的，照样解析失败。
     */
    JsonNode readFirstValue(String arguments) {
        return json.readerFor(JsonNode.class)
                .without(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                .readValue(arguments);
    }

    /**
     * 补上漏写的右括号，补不了返回 null。
     *
     * <p>模型偶尔在数组收尾时忘了先关里面最后那个对象：{@code [{"pattern":"…"]}，
     * Jackson 报「Unexpected close marker ']': expected '}'」，整次拆解就白跑了。
     * 这种「收尾符号对上的是更外面一层」的，意思是确定的 —— 把中间漏掉的补上。
     * 多出来的括号、半截截断这些猜不准，不碰。
     */
    static String closeUnclosed(String text) {
        StringBuilder out = new StringBuilder(text.length() + 8);
        Deque<Character> open = new ArrayDeque<>();
        boolean inString = false;
        boolean escaped = false;
        boolean changed = false;
        for (char c : text.toCharArray()) {
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
            } else if (c == '"') {
                inString = true;
            } else if (c == '{' || c == '[') {
                open.push(c);
            } else if (c == '}' || c == ']') {
                char opener = c == '}' ? '{' : '[';
                if (!open.contains(opener)) {
                    return null;
                }
                while (open.peek() != opener) {
                    out.append(open.pop() == '{' ? '}' : ']');
                    changed = true;
                }
                open.pop();
            }
            out.append(c);
        }
        return changed ? out.toString() : null;
    }

    private <T> T parse(String arguments, Class<T> type) {
        try {
            return read(arguments, type);
        } catch (JacksonException e) {
            String repaired = closeUnclosed(arguments);
            if (repaired != null) {
                try {
                    T result = read(repaired, type);
                    // 留个记录：看得出模型多常这样，换模型时有个参照
                    log.warn("{} 返回的 JSON 漏了右括号，补上后读出来了（{} 字符）", model, arguments.length());
                    return result;
                } catch (JacksonException ignored) {
                    // 补了括号还是不行：报原来的错，那才是模型真正写坏的地方
                }
            }
            // 带上原因和长度：截断和格式不对是两回事，光说「看不懂」没法排查
            throw new AnalysisFailedException(
                    "模型返回的结果解析不了（" + arguments.length() + " 字符）："
                            + e.getOriginalMessage(), e);
        }
    }

    private <T> T read(String arguments, Class<T> type) {
        return json.treeToValue(unwrapDoubleEncoded(readFirstValue(arguments)), type);
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
