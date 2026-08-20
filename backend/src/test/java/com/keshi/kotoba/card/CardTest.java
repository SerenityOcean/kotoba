package com.keshi.kotoba.card;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CardTest {

    private static final Instant NOW = Instant.parse("2026-08-19T00:00:00Z");

    private Card newCard() {
        return new Card("勉強", "学习", NOW);
    }

    @Test
    @DisplayName("新卡片的初始状态")
    void newCardHasInitialState() {
        Card card = newCard();

        assertEquals(0, card.getRepetitions());
        assertEquals(0, card.getIntervalDays());
        assertEquals(2.5, card.getEaseFactor());
        assertEquals(0, card.getLapses());
        assertEquals(NOW, card.getDueAt());
    }

    @Test
    @DisplayName("第一次答对，间隔变成 1 天")
    void firstGoodGivesOneDay() {
        Card card = newCard();

        int interval = card.applyReview(Rating.GOOD, NOW);

        assertEquals(1, interval);
        assertEquals(1, card.getIntervalDays());
        assertEquals(1, card.getRepetitions());
        assertEquals(NOW.plus(1, ChronoUnit.DAYS), card.getDueAt());
        assertEquals(2.5, card.getEaseFactor());
    }

    @Test
    @DisplayName("第二次答对，间隔变成 6 天")
    void secondGoodGivesSixDays() {
        Card card = newCard();
        card.applyReview(Rating.GOOD, NOW);

        int interval = card.applyReview(Rating.GOOD, NOW.plus(1, ChronoUnit.DAYS));

        assertEquals(6, interval);
        assertEquals(2, card.getRepetitions());
    }

    @Test
    @DisplayName("第三次答对，间隔按 easeFactor 增长")
    void thirdGoodMultipliesByEaseFactor() {
        Card card = newCard();
        card.applyReview(Rating.GOOD, NOW);
        card.applyReview(Rating.GOOD, NOW);

        int interval = card.applyReview(Rating.GOOD, NOW);

        assertEquals(15, interval);   // 6 * 2.5
        assertEquals(3, card.getRepetitions());
    }

    @Test
    @DisplayName("答 AGAIN 会重置进度并增加 lapses")
    void againResetsProgress() {
        Card card = newCard();
        card.applyReview(Rating.GOOD, NOW);
        card.applyReview(Rating.GOOD, NOW);

        int interval = card.applyReview(Rating.AGAIN, NOW);

        assertEquals(0, interval);
        assertEquals(0, card.getRepetitions());
        assertEquals(0, card.getIntervalDays());
        assertEquals(1, card.getLapses());
        assertEquals(NOW, card.getDueAt());
        assertEquals(2.3, card.getEaseFactor(), 0.0001);
    }

    @Test
    @DisplayName("答 HARD 会降低 easeFactor")
    void hardLowersEaseFactor() {
        Card card = newCard();

        card.applyReview(Rating.HARD, NOW);

        assertEquals(2.35, card.getEaseFactor(), 0.0001);
        assertEquals(1, card.getRepetitions());
    }

    @Test
    @DisplayName("easeFactor 不会低于 1.3")
    void easeFactorHasFloor() {
        Card card = newCard();

        for (int i = 0; i < 20; i++) {
            card.applyReview(Rating.AGAIN, NOW);
        }

        assertTrue(card.getEaseFactor() >= 1.3);
        assertEquals(1.3, card.getEaseFactor(), 0.0001);
    }
}