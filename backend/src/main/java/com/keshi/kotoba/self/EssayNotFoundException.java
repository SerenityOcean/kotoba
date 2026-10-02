package com.keshi.kotoba.self;

public class EssayNotFoundException extends RuntimeException {

    public EssayNotFoundException() {
        super("这条随笔不存在");
    }
}
