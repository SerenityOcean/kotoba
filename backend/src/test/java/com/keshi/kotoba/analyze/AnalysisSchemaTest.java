package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * schema 是从 record 推出来的，不是手写的。这个测试守的是「推导没坏」——
 * 字段改了名而 schema 没跟上，模型那边会静默地少给一块内容，很难发现。
 */
class AnalysisSchemaTest {

    @Test
    @DisplayName("schema 覆盖到四层结构和字段说明")
    void schemaCoversNestedRecords() {
        String schema = AnalysisSchema.asJson();
        System.out.println("=== 生成的 schema ===");
        System.out.println(schema);

        for (String field : new String[]{
                "sentences", "original", "translation", "verbs", "grammarPoints",
                "surface", "dictionaryForm", "reading", "form", "explanation", "meaning",
                "pattern", "example"}) {
            assertTrue(schema.contains("\"" + field + "\""), "schema 里缺字段：" + field);
        }

        // record 上的 @JsonPropertyDescription 要真的进到 schema 里，它们就是提示词
        assertTrue(schema.contains("辞书形"), "字段说明没进 schema");

        // record 表达不了必填，是后处理加上去的 —— 掉了模型就能合法地少给字段
        assertTrue(schema.contains("\"required\":[\"sentences\"]"), "顶层 required 没加上");
        assertTrue(schema.contains("\"dictionaryForm\",\"explanation\""), "动词那层 required 没加上");
    }
}
