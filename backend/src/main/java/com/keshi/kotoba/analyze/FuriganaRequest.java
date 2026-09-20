package com.keshi.kotoba.analyze;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FuriganaRequest(

        @NotBlank(message = "没有要注音的内容")
        @Size(max = 2000, message = "一次最多注音 2000 字，分段发")
        String text
) {
}
