package com.keshi.kotoba.analyze;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/** 读的时候就着选中的一段提问，拿到的回答。字段说明是提示词的一部分。 */
public record Answer(

        @JsonPropertyDescription("对读者问题的回答，中文纯文本。分段用换行，不要用 Markdown 记号")
        String answer
) {
}
