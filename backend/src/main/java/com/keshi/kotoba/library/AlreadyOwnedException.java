package com.keshi.kotoba.library;

/** 已经解锁过了：再下单、再用兑换码都不该收第二次。 */
public class AlreadyOwnedException extends RuntimeException {

    public AlreadyOwnedException(String message) {
        super(message);
    }
}
