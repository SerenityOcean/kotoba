package com.keshi.kotoba.analyze;

/** 没配模型服务的 key，拆解和解析整个是关着的。 */
public class AnalysisUnavailableException extends RuntimeException {

    public AnalysisUnavailableException() {
        super("AI 功能没开：服务端没配模型服务的 API key");
    }
}
