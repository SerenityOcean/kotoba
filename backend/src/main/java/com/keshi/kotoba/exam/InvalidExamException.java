package com.keshi.kotoba.exam;

/** 卷子能解析，但内容说不通：题号重复、整份太大。消息直接给人看。 */
public class InvalidExamException extends RuntimeException {

    public InvalidExamException(String message) {
        super(message);
    }
}
