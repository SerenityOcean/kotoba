package com.keshi.kotoba.exam;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 一段文字里涂了的一截：从第 start 个字到第 end 个字之前，按去掉振り仮名的文字数。
 * text 是涂上的那几个字 —— 文字万一变了（解析重新生成过），前端拿它对不上就不涂，
 * 不会涂到别的字上。color 是第几支笔，1–4，各是什么颜色由前端定。
 */
public record HighlightRange(

        @Min(value = 0, message = "涂色的位置不对")
        @Max(value = 20000, message = "涂色的位置不对")
        int start,

        @Min(value = 1, message = "涂色的位置不对")
        @Max(value = 20000, message = "涂色的位置不对")
        int end,

        @NotNull(message = "没有涂上的文字")
        @Size(min = 1, max = 5000, message = "一次涂的太长了")
        String text,

        @Min(value = 1, message = "没有这个颜色")
        @Max(value = 4, message = "没有这个颜色")
        int color
) {

    @JsonIgnore
    @AssertTrue(message = "涂色的位置不对")
    public boolean isOrdered() {
        return start < end;
    }
}
