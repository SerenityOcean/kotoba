package com.keshi.kotoba.exam;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;

/** 交卷：题号 → 选了第几个（从 1 数），没答的题不放进来；用时按秒。 */
public record AttemptRequest(

        @NotNull(message = "没有答案")
        @Size(max = 500, message = "答案太多了")
        Map<@NotNull Integer, @NotNull @Min(value = 1, message = "选项不对") @Max(value = 8, message = "选项不对") Integer> answers,

        @Min(value = 0, message = "用时不对")
        @Max(value = 86400, message = "用时不对")
        int elapsedSeconds
) {
}
