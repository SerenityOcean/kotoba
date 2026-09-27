package com.keshi.kotoba.auth;

/** 注册、改密码、重置密码三处共用的密码规则。 */
final class PasswordRules {

    static final int MIN = 8;
    // 上限 72 是 bcrypt 的硬限制，再长的部分会被悄悄截掉
    static final int MAX = 72;
    static final String MESSAGE = "密码长度需在 8 到 72 之间";

    private PasswordRules() {
    }
}
