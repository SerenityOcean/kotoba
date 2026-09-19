package com.keshi.kotoba.deck;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeckRequest(

        @NotBlank(message = "包名不能为空")
        @Size(max = 60, message = "包名最长 60 个字符")
        String name
) {
}
