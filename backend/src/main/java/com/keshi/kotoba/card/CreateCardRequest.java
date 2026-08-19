package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotBlank;

public record CreateCardRequest(

        @NotBlank
        String front,

        String back
) {
}