package com.keshi.kotoba.card;

import java.time.Instant;

public record CardResponse(
        Long id,
        Long deckId,
        String front,
        String back,
        String reading,
        /* 这张卡值得考读音、但还没有读音 —— 卡片页据此提示「补读音」 */
        boolean readingMissing,
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
                card.getDeckId(),
                card.getFront(),
                card.getBack(),
                card.getReading(),
                card.getReading() == null && Readings.wanted(card.getFront()),
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