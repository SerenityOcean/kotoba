package com.keshi.kotoba.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 固定窗口计数：每个 key 在 window 内最多 limit 次。
 *
 * 存在内存里 —— 单实例部署够用，重启清零也无所谓（重启本身就挡了攻击者几秒）。
 * 哪天后端跑多个实例，这里得换成 Redis 之类的共享计数。
 */
final class RateLimiter {

    /** 超过这么多 key 就顺手清一遍过期窗口，免得被随机用户名撑爆内存。 */
    private static final int SWEEP_THRESHOLD = 10_000;

    private final int limit;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    RateLimiter(int limit, Duration window, Clock clock) {
        this.limit = limit;
        this.window = window;
        this.clock = clock;
    }

    /** 还剩多久才能再试；null 表示现在就行（不计数）。 */
    Duration blockedFor(String key) {
        Instant now = clock.instant();
        Window w = windows.get(key);
        if (w == null || !now.isBefore(w.resetAt) || w.count < limit) {
            return null;
        }
        return Duration.between(now, w.resetAt);
    }

    /** 记一次。 */
    void hit(String key) {
        Instant now = clock.instant();
        if (windows.size() > SWEEP_THRESHOLD) {
            windows.values().removeIf(w -> !now.isBefore(w.resetAt));
        }
        windows.compute(key, (k, w) -> w == null || !now.isBefore(w.resetAt)
                ? new Window(1, now.plus(window))
                : new Window(w.count + 1, w.resetAt));
    }

    /** 先查再记：没超就记一次返回 null，超了就不记、返回还要等多久。 */
    Duration tryAcquire(String key) {
        Duration blocked = blockedFor(key);
        if (blocked == null) {
            hit(key);
        }
        return blocked;
    }

    void reset(String key) {
        windows.remove(key);
    }

    private record Window(int count, Instant resetAt) {
    }
}
