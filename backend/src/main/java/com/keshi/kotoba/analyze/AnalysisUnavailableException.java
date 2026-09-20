package com.keshi.kotoba.analyze;

/** 没配模型服务的 key，这个功能整个是关着的。 */
public class AnalysisUnavailableException extends RuntimeException {

    public AnalysisUnavailableException() {
        super("拆解功能没开：服务端没配模型服务的 API key");
    }
}
