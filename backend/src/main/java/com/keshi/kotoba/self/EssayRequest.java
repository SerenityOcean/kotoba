package com.keshi.kotoba.self;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EssayRequest(

        @NotBlank(message = "写点什么再落笔吧")
        @Size(max = EssayService.MAX_LENGTH, message = "一条最多 " + EssayService.MAX_LENGTH + " 字")
        String body
) {
}
