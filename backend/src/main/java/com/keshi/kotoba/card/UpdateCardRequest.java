package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotBlank;

public record UpdateCardRequest(

        @NotBlank
        String front,

        String back,

        /** 读音，几个读音用 ／ 隔开。留空就按正反面重新猜。 */
        String reading
) {
}