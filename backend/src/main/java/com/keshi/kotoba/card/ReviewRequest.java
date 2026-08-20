package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotNull;

public record ReviewRequest(

        @NotNull
        Rating rating
) {
}