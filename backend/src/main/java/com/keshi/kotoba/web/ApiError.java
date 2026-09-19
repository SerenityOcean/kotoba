package com.keshi.kotoba.web;

/** 出错时的响应体，前端直接把 message 显示出来。 */
public record ApiError(String message) {
}
