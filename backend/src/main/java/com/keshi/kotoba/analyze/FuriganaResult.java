package com.keshi.kotoba.analyze;

/** @param text 注音后的文本。词典里查不到的词原样留着，不注 */
public record FuriganaResult(String text) {
}
