package com.keshi.kotoba.auth;

/** 登录/注册失败时的响应体，前端直接把 message 显示出来。 */
public record ApiError(String message) {
}
