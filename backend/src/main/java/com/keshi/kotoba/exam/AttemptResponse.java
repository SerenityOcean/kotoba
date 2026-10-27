package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.Map;

/** 一次交卷。correct / graded 是答对的题数 / 计分的题数（有答案的题）。 */
public record AttemptResponse(
        Long id,
        Map<Integer, Integer> answers,
        int correct,
        int graded,
        int elapsedSeconds,
        Instant submittedAt
) {
}
