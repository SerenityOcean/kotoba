package com.keshi.kotoba.self;

/** 登录了，但不是 self 的主人。 */
public class NotOwnerException extends RuntimeException {

    public NotOwnerException() {
        super("这里只有主人能写");
    }
}
