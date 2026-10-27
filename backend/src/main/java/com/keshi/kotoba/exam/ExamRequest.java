package com.keshi.kotoba.exam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ExamRequest(

        @NotBlank(message = "标题不能为空")
        @Size(max = 200, message = "标题太长了")
        String title,

        @NotNull(message = "卷子里没有题目")
        @Valid
        ExamContent content
) {
}
