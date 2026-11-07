package com.keshi.kotoba.exam;

import java.time.Instant;
import java.util.Map;

/**
 * 做到一半的进度：题号 → 选了第几个，用时按秒，这一遍做完记下的成绩（还没做完是 null）。
 * updatedAt 是后端存下的时间，几台设备靠它比谁的新。
 */
public record ProgressResponse(
        Map<Integer, Integer> answers,
        int elapsedSeconds,
        Long recordedAttemptId,
        Instant updatedAt
) {
}
