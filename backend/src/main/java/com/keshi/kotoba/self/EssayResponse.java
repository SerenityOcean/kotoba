package com.keshi.kotoba.self;

import java.time.Instant;

public record EssayResponse(Long id, String body, Instant writtenAt, Instant editedAt) {

    public static EssayResponse from(Essay essay) {
        return new EssayResponse(essay.getId(), essay.getBody(), essay.getWrittenAt(), essay.getEditedAt());
    }
}
