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

    public static CardResponse from(Card card, UserCardState state) {
        return new CardResponse(
                card.getId(),
                card.getFront(),
                card.getBack(),
                state.getDueAt(),
                state.getIntervalDays(),
                state.getRepetitions(),
                state.getEaseFactor(),
                state.getLapses(),
                card.getCreatedAt()
        );
    }

    public static CardResponse from(CardService.CardWithState pair) {
        return from(pair.card(), pair.state());
    }
}