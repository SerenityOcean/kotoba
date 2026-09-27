package com.keshi.kotoba.auth;

import java.time.Instant;

/**
 * 账号页"登录设备"里的一行。id 不是真的 session id —— 那就是 cookie 本身，
 * 交给前端 JS 等于白设了 HttpOnly。这里给的是它的哈希，只用来点名"踢掉这个"。
 */
public record SessionView(String id,
                          Instant createdAt,
                          Instant lastAccessedAt,
                          String userAgent,
                          String ip,
                          boolean current) {
}
