package com.keshi.kotoba.analyze;

import java.time.Duration;

/** 拆解次数超了配额。回 429，带上多久之后能再试。 */
public class AnalyzeLimitException extends RuntimeException {

    private final Duration retryAfter;

    AnalyzeLimitException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
