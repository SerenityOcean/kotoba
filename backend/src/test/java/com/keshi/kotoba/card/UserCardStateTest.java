package com.keshi.kotoba.card;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserCardStateTest {

    private static final Instant NOW = Instant.parse("2026-08-19T00:00:00Z");

    private UserCardState newState() {
        return new UserCardState(1L, 1L, NOW);
    }

    @Test
    @DisplayName("新卡片的初始状态")
    void newCardHasInitialState() {
        UserCardState state = newState();

        assertEquals(0, state.getRepetitions());
        assertEquals(0, state.getIntervalDays());
        assertEquals(2.5, state.getEaseFactor());
        assertEquals(0, state.getLapses());
        assertEquals(NOW, state.getDueAt());
    }

    @Test
    @DisplayName("第一次答对，间隔变成 1 天")
    void firstGoodGivesOneDay() {
        UserCardState state = newState();

        int interval = state.applyReview(Rating.GOOD, NOW);

        assertEquals(1, interval);
        assertEquals(1, state.getIntervalDays());
        assertEquals(1, state.getRepetitions());
        assertEquals(NOW.plus(1, ChronoUnit.DAYS), state.getDueAt());
        assertEquals(2.5, state.getEaseFactor());
    }

    @Test
    @DisplayName("第二次答对，间隔变成 6 天")
    void secondGoodGivesSixDays() {
        UserCardState state = newState();
        state.applyReview(Rating.GOOD, NOW);

        int interval = state.applyReview(Rating.GOOD, NOW.plus(1, ChronoUnit.DAYS));

        assertEquals(6, interval);
        assertEquals(2, state.getRepetitions());
    }

    @Test
    @DisplayName("第三次答对，间隔按 easeFactor 增长")
    void thirdGoodMultipliesByEaseFactor() {
        UserCardState state = newState();
        state.applyReview(Rating.GOOD, NOW);
        state.applyReview(Rating.GOOD, NOW);

        int interval = state.applyReview(Rating.GOOD, NOW);

        assertEquals(15, interval);   // 6 * 2.5
        assertEquals(3, state.getRepetitions());
    }

    @Test
    @DisplayName("答 AGAIN 会重置进度并增加 lapses")
    void againResetsProgress() {
        UserCardState state = newState();
        state.applyReview(Rating.GOOD, NOW);
        state.applyReview(Rating.GOOD, NOW);

        int interval = state.applyReview(Rating.AGAIN, NOW);

        assertEquals(0, interval);
        assertEquals(0, state.getRepetitions());
        assertEquals(0, state.getIntervalDays());
        assertEquals(1, state.getLapses());
        assertEquals(NOW, state.getDueAt());
        assertEquals(2.3, state.getEaseFactor(), 0.0001);
    }

    @Test
    @DisplayName("答 HARD 会降低 easeFactor")
    void hardLowersEaseFactor() {
        UserCardState state = newState();

        state.applyReview(Rating.HARD, NOW);

        assertEquals(2.35, state.getEaseFactor(), 0.0001);
        assertEquals(1, state.getRepetitions());
    }

    @Test
    @DisplayName("easeFactor 不会低于 1.3")
    void easeFactorHasFloor() {
        UserCardState state = newState();

        for (int i = 0; i < 20; i++) {
            state.applyReview(Rating.AGAIN, NOW);
        }

        assertTrue(state.getEaseFactor() >= 1.3);
        assertEquals(1.3, state.getEaseFactor(), 0.0001);
    }
}