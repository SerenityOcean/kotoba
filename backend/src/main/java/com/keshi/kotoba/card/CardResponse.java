package com.keshi.kotoba.card;

import java.time.Instant;

public record CardResponse(
        Long id,
        String front,
        String back,
        Instant dueAt,
        int intervalDays,
        int repetitions,
        double easeFactor,
        int lapses,
        Instant createdAt
) {

    public static CardResponse from(Card card) {
        return new CardResponse(
                card.getId(),
                card.getFront(),
                card.getBack(),
                card.getDueAt(),
                card.getIntervalDays(),
                card.getRepetitions(),
                card.getEaseFactor(),
                card.getLapses(),
                card.getCreatedAt()
        );
    }
}