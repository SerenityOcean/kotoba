package com.keshi.kotoba.auth;

/** 409 一类：邮箱/第三方账号已经被别人占了。 */
public class AccountConflictException extends RuntimeException {

    public AccountConflictException(String message) {
        super(message);
    }
}
