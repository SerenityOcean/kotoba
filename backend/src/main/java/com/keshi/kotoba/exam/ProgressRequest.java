package com.keshi.kotoba.exam;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;

/** 存进度：和交卷一样的答案格式，再带上这一遍做完记下的成绩（没做完不传）。 */
public record ProgressRequest(

        @NotNull(message = "没有答案")
        @Size(max = 500, message = "答案太多了")
        Map<@NotNull Integer, @NotNull @Min(value = 1, message = "选项不对") @Max(value = 8, message = "选项不对") Integer> answers,

        @Min(value = 0, message = "用时不对")
        @Max(value = 86400, message = "用时不对")
        int elapsedSeconds,

        Long recordedAttemptId
) {
}
