package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.Map;

/** 列表里的一份：做完过几遍，最近一次的成绩（没做完过是 null），每档难度标了几题（1–3 → 题数）。 */
public record ExamSummary(
        Long id,
        String title,
        int questionCount,
        int gradedCount,
        Instant createdAt,
        int attemptCount,
        AttemptResponse lastAttempt,
        Map<Integer, Integer> markCounts
) {
}
