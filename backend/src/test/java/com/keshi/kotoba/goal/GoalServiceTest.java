package com.keshi.kotoba.goal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoalServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-23T04:00:00Z");
    private static final LocalDate TODAY = LocalDate.parse("2026-09-23");

    private GoalRepository goals;
    private GoalService goalService;

    @BeforeEach
    void setUp() {
        goals = mock(GoalRepository.class);
        when(goals.save(any(Goal.class))).thenAnswer(call -> call.getArgument(0));
        goalService = new GoalService(goals);
    }

    @Test
    @DisplayName("第一次立目标时记下起点，顺手 trim")
    void firstSaveRecordsStart() {
        when(goals.findById(1L)).thenReturn(Optional.empty());

        Goal goal = goalService.save(1L, "  JLPT N2  ", TODAY.plusDays(76), NOW);

        assertEquals("JLPT N2", goal.getTitle());
        assertEquals(NOW, goal.getStartedAt());
    }

    @Test
    @DisplayName("改名改日期时起点不变，周格子不会被清零")
    void reviseKeepsStart() {
        Instant earlier = NOW.minusSeconds(86_400 * 30);
        when(goals.findById(1L)).thenReturn(
                Optional.of(new Goal(1L, "N2", TODAY.plusDays(40), earlier)));

        Goal goal = goalService.save(1L, "JLPT N2", TODAY.plusDays(76), NOW);

        assertEquals("JLPT N2", goal.getTitle());
        assertEquals(TODAY.plusDays(76), goal.getTargetDate());
        assertEquals(earlier, goal.getStartedAt());
    }

    @Test
    @DisplayName("按 UTC 算的昨天也放行 —— 东八区凌晨那会儿 UTC 还没过零点")
    void allowsOneDayOfTimezoneSlack() {
        when(goals.findById(1L)).thenReturn(Optional.empty());

        Goal goal = goalService.save(1L, "N2", TODAY.minusDays(1), NOW);

        assertEquals(TODAY.minusDays(1), goal.getTargetDate());
    }

    @Test
    @DisplayName("已经过去的日期立不了")
    void rejectsPastDate() {
        assertThrows(IllegalArgumentException.class,
                () -> goalService.save(1L, "N2", TODAY.minusDays(2), NOW));
        verify(goals, never()).save(any(Goal.class));
    }

    @Test
    @DisplayName("超过十年的目标立不了")
    void rejectsTooFarDate() {
        assertThrows(IllegalArgumentException.class,
                () -> goalService.save(1L, "N2", TODAY.plusYears(GoalService.MAX_YEARS).plusDays(1), NOW));
    }

    @Test
    @DisplayName("只有空格的目标名立不了")
    void rejectsBlankTitle() {
        assertThrows(IllegalArgumentException.class,
                () -> goalService.save(1L, "   ", TODAY.plusDays(10), NOW));
    }
}
