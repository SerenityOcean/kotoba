package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 一份卷子，连卷面、历次交卷（最近的在前）和每道题标的难度（题号 → 1–3，没标的不在里面）。 */
public record ExamResponse(
        Long id,
        String title,
        ExamContent content,
        int questionCount,
        int gradedCount,
        Instant createdAt,
        List<AttemptResponse> attempts,
        Map<Integer, Integer> marks
) {
}
