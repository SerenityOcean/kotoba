package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotBlank;

public record UpdateCardRequest(

        @NotBlank
        String front,

        String back
) {
}