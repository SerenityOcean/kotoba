package com.keshi.kotoba.analyze;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TranslateRequest(

        @NotBlank(message = "请先选中要翻译的日语")
        @Size(max = 1500, message = "一次最多翻译 1500 字，太长了分几次选")
        String text,

        /** 选中那段的前后文，没有就不传。只选了半句时，译文靠它才不走样 */
        @Size(max = 2000, message = "上下文太长了")
        String context
) {
}
