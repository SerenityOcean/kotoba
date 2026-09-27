package com.keshi.kotoba.auth;

public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException() {
        // 不存在、过期、用过了 —— 对用户来说是一回事，也别告诉攻击者是哪一种
        super("链接无效或已过期，请重新申请");
    }
}
