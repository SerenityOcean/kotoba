package com.keshi.kotoba.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record GoalRequest(

        @NotBlank(message = "目标不能为空")
        @Size(max = 30, message = "目标最长 30 个字符")
        String title,

        @NotNull(message = "请选择目标日期")
        LocalDate targetDate
) {
}
