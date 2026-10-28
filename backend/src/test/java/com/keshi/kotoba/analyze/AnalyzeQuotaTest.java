package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnalyzeQuotaTest {

    /** 能往前拨的时钟。 */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-11T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private final MutableClock clock = new MutableClock();

    private void use(AnalyzeQuota quota, long userId, int times) {
        for (int i = 0; i < times; i++) {
            quota.acquire(userId);
        }
    }

    @Test
    @DisplayName("每分钟超了就拒，过一分钟恢复")
    void limitsPerMinute() {
        AnalyzeQuota quota = new AnalyzeQuota(clock, 3, 100, 1000, 1000);
        use(quota, 1L, 3);

        AnalyzeLimitException e = assertThrows(AnalyzeLimitException.class, () -> quota.acquire(1L));
        assertTrue(e.getMessage().contains("太快"), e.getMessage());

        clock.advance(Duration.ofMinutes(1));
        assertDoesNotThrow(() -> quota.acquire(1L));
    }

    @Test
    @DisplayName("每人 24 小时的总数超了就拒，别人不受影响")
    void limitsPerUserPerDay() {
        AnalyzeQuota quota = new AnalyzeQuota(clock, 100, 5, 1000, 1000);
        use(quota, 1L, 5);

        AnalyzeLimitException e = assertThrows(AnalyzeLimitException.class, () -> quota.acquire(1L));
        assertTrue(e.getMessage().contains("24 小时内最多拆解 5 次"), e.getMessage());
        assertDoesNotThrow(() -> quota.acquire(2L));

        clock.advance(Duration.ofDays(1));
        assertDoesNotThrow(() -> quota.acquire(1L));
    }

    @Test
    @DisplayName("全站总数超了，谁都拒 —— 批量注册小号也绕不过去")
    void limitsGlobally() {
        AnalyzeQuota quota = new AnalyzeQuota(clock, 100, 100, 4, 1000);
        use(quota, 1L, 2);
        use(quota, 2L, 2);

        AnalyzeLimitException e = assertThrows(AnalyzeLimitException.class, () -> quota.acquire(3L));
        assertTrue(e.getMessage().contains("全站"), e.getMessage());
    }

    @Test
    @DisplayName("体验账号另有一道小得多的上限；普通账号照旧")
    void limitsDemoAccount() {
        AnalyzeQuota quota = new AnalyzeQuota(clock, 100, 100, 1000, 2);
        quota.acquire(1L, true);
        quota.acquire(1L, true);

        AnalyzeLimitException e = assertThrows(AnalyzeLimitException.class, () -> quota.acquire(1L, true));
        assertTrue(e.getMessage().contains("体验账号"), e.getMessage());
        assertDoesNotThrow(() -> quota.acquire(2L));

        clock.advance(Duration.ofDays(1));
        assertDoesNotThrow(() -> quota.acquire(1L, true));
    }

    @Test
    @DisplayName("被拒的那次不记数：拒了之后一分钟内一直拒，不会把每天的额度也耗掉")
    void rejectedCallsAreNotCounted() {
        AnalyzeQuota quota = new AnalyzeQuota(clock, 2, 3, 1000, 1000);
        use(quota, 1L, 2);
        for (int i = 0; i < 10; i++) {
            assertThrows(AnalyzeLimitException.class, () -> quota.acquire(1L));
        }

        clock.advance(Duration.ofMinutes(1));
        // 每天 3 次只用掉了 2 次，还剩 1 次
        assertDoesNotThrow(() -> quota.acquire(1L));
        assertThrows(AnalyzeLimitException.class, () -> quota.acquire(1L));
    }
}
