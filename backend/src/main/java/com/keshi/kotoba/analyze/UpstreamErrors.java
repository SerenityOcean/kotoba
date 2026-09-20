package com.keshi.kotoba.analyze;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 上游报错时回的是一坨 JSON，整个甩给用户看没法读。
 * 把里面的 message 抠出来，抠不到就原样返回 —— 宁可难看也别把信息弄丢。
 */
final class UpstreamErrors {

    private static final Pattern MESSAGE = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    private UpstreamErrors() {
    }

    static String readable(String raw) {
        if (raw == null || raw.isBlank()) {
            return "没有更多信息";
        }
        Matcher matcher = MESSAGE.matcher(raw);
        if (!matcher.find()) {
            return raw;
        }
        // 取最后一个 message：错误体常是 {"type":"error","error":{...,"message":"真正的原因"}}
        String message = matcher.group(1);
        while (matcher.find()) {
            message = matcher.group(1);
        }
        return message.replace("\\\"", "\"").replace("\\n", " ");
    }
}
