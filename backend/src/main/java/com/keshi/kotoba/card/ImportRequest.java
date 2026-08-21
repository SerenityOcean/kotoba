package com.keshi.kotoba.card;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportRequest(

        @NotNull
        @Size(min = 1, max = 500, message = "一次最多导入 500 张")
        @Valid
        List<CreateCardRequest> cards
) {
}