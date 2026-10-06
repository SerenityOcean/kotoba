package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record FillCardsRequest(

        @NotNull
        @Size(min = 1, max = CardService.MAX_FILL_BATCH, message = "一次最多补 50 张")
        List<Long> ids
) {
}
