package com.keshi.kotoba.library;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 主人上传一篇随笔：整篇覆盖。
 *
 * @param pack      挂在哪个包上（slug）；留空就是谁都能读的
 * @param published 发出来的日子；留空是草稿，只有主人看得见
 */
public record EssayUpsertRequest(

        @NotBlank(message = "标题不能为空")
        @Size(max = 80, message = "标题最长 80 个字符")
        String title,

        @Size(max = 60)
        String pack,

        @NotBlank(message = "正文不能为空")
        @Size(max = 60000, message = "正文太长了，一篇最多 6 万字")
        String body,

        LocalDate published,

        Integer sort
) {
}
