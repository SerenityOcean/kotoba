package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 一份卷子，连卷面、历次成绩（最近的在前）、每道题标的难度（题号 → 1–3）
 * 和已经生成过的解析（题号 → 解析）。没标、没生成的题不在里面。
 */
public record ExamResponse(
        Long id,
        String title,
        ExamContent content,
        int questionCount,
        int gradedCount,
        Instant createdAt,
        List<AttemptResponse> attempts,
        Map<Integer, Integer> marks,
        Map<Integer, QuestionExplanation> explanations
) {
}
