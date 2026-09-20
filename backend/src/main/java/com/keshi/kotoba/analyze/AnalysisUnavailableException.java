package com.keshi.kotoba.analyze;

/** 没配 API key，这个功能整个是关着的。 */
public class AnalysisUnavailableException extends RuntimeException {

    public AnalysisUnavailableException() {
        super("拆解功能没开：服务端没配 ANTHROPIC_API_KEY");
    }
}
