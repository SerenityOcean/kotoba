package com.keshi.kotoba.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LoginThrottleTest {

    /** 能往前拨的时钟。 */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginThrottle throttle = new LoginThrottle(clock);

    @Test
    @DisplayName("同一 IP 对同一账号连错 5 次就锁，15 分钟后解开")
    void locksAfterFiveFailures() {
        for (int i = 0; i < 5; i++) {
            throttle.checkLogin("1.1.1.1", "keshi");
            throttle.onLoginFailure("1.1.1.1", "keshi");
        }
        assertThrows(TooManyAttemptsException.class, () -> throttle.checkLogin("1.1.1.1", "keshi"));

        clock.advance(Duration.ofMinutes(15));
        assertDoesNotThrow(() -> throttle.checkLogin("1.1.1.1", "keshi"));
    }

    @Test
    @DisplayName("别的 IP 输错不会把本人锁在外面")
    void lockIsPerIp() {
        for (int i = 0; i < 5; i++) {
            throttle.onLoginFailure("6.6.6.6", "keshi");
        }
        assertThrows(TooManyAttemptsException.class, () -> throttle.checkLogin("6.6.6.6", "Keshi"));
        assertDoesNotThrow(() -> throttle.checkLogin("1.1.1.1", "keshi"));
    }

    @Test
    @DisplayName("登录成功清零失败计数")
    void successResetsFailures() {
        for (int i = 0; i < 4; i++) {
            throttle.onLoginFailure("1.1.1.1", "keshi");
        }
        throttle.onLoginSuccess("1.1.1.1", "keshi");
        throttle.onLoginFailure("1.1.1.1", "keshi");

        assertDoesNotThrow(() -> throttle.checkLogin("1.1.1.1", "keshi"));
    }

    @Test
    @DisplayName("一个 IP 一小时最多注册 5 次")
    void limitsRegistrations() {
        for (int i = 0; i < 5; i++) {
            throttle.checkRegister("1.1.1.1");
        }
        assertThrows(TooManyAttemptsException.class, () -> throttle.checkRegister("1.1.1.1"));
        assertDoesNotThrow(() -> throttle.checkRegister("2.2.2.2"));

        clock.advance(Duration.ofHours(1));
        assertDoesNotThrow(() -> throttle.checkRegister("1.1.1.1"));
    }
}
