package com.keshi.kotoba.deck;

import java.time.Instant;

/** 包 + 它的卡片数和今天到期数 —— 列表页要一次拿全。 */
public record DeckResponse(
        Long id,
        String name,
        long cardCount,
        long dueCount,
        Instant createdAt
) {

    public static DeckResponse from(Deck deck, long cardCount, long dueCount) {
        return new DeckResponse(deck.getId(), deck.getName(), cardCount, dueCount, deck.getCreatedAt());
    }
}
