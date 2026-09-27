package com.keshi.kotoba.auth;

/** 哪些可选的登录功能在这台服务器上配好了。前端据此决定显示哪些按钮。 */
public record FeaturesResponse(boolean email, boolean github) {
}
