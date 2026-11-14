package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/** 读的时候选中一段，只要译文。字段说明是提示词的一部分。 */
public record Translation(

        @JsonPropertyDescription("选中那段日语的中文译文：自然通顺，只有译文本身，不加解释、不加引号")
        String translation
) {
}
