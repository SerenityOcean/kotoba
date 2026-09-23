package com.keshi.kotoba.goal;

import java.time.Instant;
import java.time.LocalDate;

public record GoalResponse(
        String title,
        LocalDate targetDate,
        Instant startedAt
) {

    public static GoalResponse from(Goal goal) {
        return new GoalResponse(goal.getTitle(), goal.getTargetDate(), goal.getStartedAt());
    }
}
