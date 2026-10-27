package com.keshi.kotoba.exam;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** 给一道题标难度：1 简单、2 一般、3 难。 */
public record MarkRequest(

        @NotNull(message = "没有难度")
        @Min(value = 1, message = "难度只有 1–3")
        @Max(value = 3, message = "难度只有 1–3")
        Integer level
) {
}
