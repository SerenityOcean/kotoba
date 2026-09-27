package com.keshi.kotoba.auth;

import java.time.Duration;

public class TooManyAttemptsException extends RuntimeException {

    private final Duration retryAfter;

    public TooManyAttemptsException(Duration retryAfter) {
        super("尝试太频繁了，请 " + Math.max(1, (retryAfter.toSeconds() + 59) / 60) + " 分钟后再试");
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
