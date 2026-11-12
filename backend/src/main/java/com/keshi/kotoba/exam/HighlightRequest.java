package com.keshi.kotoba.exam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * 改了涂色的那几段文字，各自现在涂着哪几截；一截都不剩的给空列表。没提到的段不动 ——
 * 两台设备各涂各的，不会互相盖掉。
 */
public record HighlightRequest(

        @NotEmpty(message = "没有要存的涂色")
        @Size(max = 100, message = "一次涂的段落太多了")
        Map<@Pattern(regexp = "[a-z0-9.]{1,40}", message = "不认识的段落") String,
                @NotNull @Size(max = 100, message = "一段里涂的太碎了") List<@NotNull @Valid HighlightRange>> highlights
) {
}
