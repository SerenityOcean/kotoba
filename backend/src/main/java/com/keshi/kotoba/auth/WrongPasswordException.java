package com.keshi.kotoba.auth;

/** 改密码、换邮箱时验的"当前密码"不对。 */
public class WrongPasswordException extends RuntimeException {

    public WrongPasswordException() {
        super("当前密码不正确");
    }
}
