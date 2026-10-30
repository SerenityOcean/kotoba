package com.keshi.kotoba.library;

/** 要先解锁：读付费随笔、导入没买的包。 */
public class LockedException extends RuntimeException {

    public LockedException(String message) {
        super(message);
    }
}
