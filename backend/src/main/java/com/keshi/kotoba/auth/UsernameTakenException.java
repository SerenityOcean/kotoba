package com.keshi.kotoba.auth;

public class UsernameTakenException extends RuntimeException {

    public UsernameTakenException(String username) {
        super("用户名已被占用：" + username);
    }
}
