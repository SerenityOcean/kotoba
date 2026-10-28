package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.victools.jsonschema.generator.OptionPreset;
import com.github.victools.jsonschema.generator.SchemaGenerator;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder;
import com.github.victools.jsonschema.generator.SchemaVersion;
import com.github.victools.jsonschema.module.jackson.JacksonModule;
import com.github.victools.jsonschema.module.jackson.JacksonOption;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 从结果的 record（拆解是 {@link Analysis}）推出 JSON schema。
 *
 * <p>Anthropic SDK 自己会做这件事，OpenAI 兼容接口要我们把 schema 显式传过去。
 * 两边共用这一份推导，省得手写第二份跟 record 走散 —— record 上的
 * {@code @JsonPropertyDescription} 依然是提示词的一部分。
 */
final class AnalysisSchema {

    /** 推一次就够了：record 在运行时不会变 */
    private static final Map<Class<?>, String> SCHEMAS = new ConcurrentHashMap<>();

    private AnalysisSchema() {
    }

    static String asJson() {
        return asJson(Analysis.class);
    }

    static String asJson(Class<?> type) {
        return SCHEMAS.computeIfAbsent(type, t -> generate(t).toString());
    }

    private static ObjectNode generate(Class<?> type) {
        JacksonModule jackson = new JacksonModule(
                JacksonOption.RESPECT_JSONPROPERTY_ORDER,
                JacksonOption.INCLUDE_ONLY_JSONPROPERTY_ANNOTATED_METHODS);

        SchemaGeneratorConfigBuilder builder = new SchemaGeneratorConfigBuilder(
                SchemaVersion.DRAFT_2020_12, OptionPreset.PLAIN_JSON)
                .with(jackson);

        ObjectNode schema = new SchemaGenerator(builder.build()).generateSchema(type);
        requireEverything(schema);
        return schema;
    }

    /**
     * record 表达不了「这个字段必填」，推出来的 schema 里每一项都是可选的。
     * 于是模型可以合法地漏掉 explanation 或 translation —— 界面上就是某块
     * 空着，不报错，很难发现。这里把每层对象的字段全标成 required。
     */
    private static void requireEverything(JsonNode node) {
        if (node.isArray()) {
            node.forEach(AnalysisSchema::requireEverything);
            return;
        }
        if (!node.isObject()) {
            return;
        }

        JsonNode properties = node.get("properties");
        if (properties != null && properties.isObject() && !properties.isEmpty()) {
            ArrayNode required = ((ObjectNode) node).putArray("required");
            properties.fieldNames().forEachRemaining(required::add);
        }

        node.forEach(AnalysisSchema::requireEverything);
    }
}
