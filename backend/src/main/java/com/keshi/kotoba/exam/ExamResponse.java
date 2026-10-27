package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.List;

/** 一份卷子，连卷面和历次交卷（最近的在前）。 */
public record ExamResponse(
        Long id,
        String title,
        ExamContent content,
        int questionCount,
        int gradedCount,
        Instant createdAt,
        List<AttemptResponse> attempts
) {
}
