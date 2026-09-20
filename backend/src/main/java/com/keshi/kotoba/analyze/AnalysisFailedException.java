package com.keshi.kotoba.analyze;

/** 调模型这一步出错了 —— 限流、超时、上游 5xx 都归这儿。 */
public class AnalysisFailedException extends RuntimeException {

    public AnalysisFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
