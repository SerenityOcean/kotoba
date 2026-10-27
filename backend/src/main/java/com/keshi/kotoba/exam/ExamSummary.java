package com.keshi.kotoba.exam;

import java.time.Instant;

/** 列表里的一份：做过几次，最近一次的成绩（没做过是 null）。 */
public record ExamSummary(
        Long id,
        String title,
        int questionCount,
        int gradedCount,
        Instant createdAt,
        int attemptCount,
        AttemptResponse lastAttempt
) {
}
