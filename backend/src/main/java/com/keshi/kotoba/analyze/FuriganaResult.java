package com.keshi.kotoba.analyze;

/**
 * @param text      注音后的文本；没注成就是原文
 * @param annotated 注音成功了没有。失败时前端该告诉用户这段是原样存的，
 *                  而不是假装注过音
 */
public record FuriganaResult(String text, boolean annotated) {
}
