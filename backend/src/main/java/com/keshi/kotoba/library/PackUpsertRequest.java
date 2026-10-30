package com.keshi.kotoba.library;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** 主人上传一个包：整份覆盖。library/upload.py 从 JSON 文件读出来原样发。 */
public record PackUpsertRequest(

        @NotBlank(message = "标题不能为空")
        @Size(max = 60, message = "标题最长 60 个字符")
        String title,

        @NotBlank(message = "级别不能为空")
        @Size(max = 30, message = "级别最长 30 个字符")
        String level,

        // 一个字；扩展区的汉字在 Java 里占两个 char
        @NotBlank(message = "封面要一个字")
        @Size(max = 2, message = "封面只放一个字")
        String glyph,

        @NotNull(message = "要选一个颜色")
        @Pattern(regexp = "sakura|take|ai|kin", message = "颜色只有 sakura、take、ai、kin")
        String tint,

        @NotBlank(message = "一句话介绍不能为空")
        @Size(max = 120, message = "一句话介绍最长 120 字")
        String summary,

        @NotBlank(message = "详情介绍不能为空")
        @Size(max = 1000, message = "详情介绍最长 1000 字")
        String intro,

        @NotNull(message = "要给一个状态")
        Pack.Status status,

        @Positive(message = "价格要大于 0")
        Integer priceCents,

        @Size(max = 40, message = "备注最长 40 字")
        String note,

        Integer sort,

        @NotNull(message = "内容不能为空")
        @Valid
        PackContent content
) {
}
