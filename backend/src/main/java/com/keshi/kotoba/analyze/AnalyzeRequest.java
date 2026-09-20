package com.keshi.kotoba.analyze;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnalyzeRequest(

        @NotBlank(message = "请先粘贴要拆解的日语原文")
        @Size(max = 1500, message = "一次最多拆解 1500 字，太长了分几次贴")
        String text
) {
}
