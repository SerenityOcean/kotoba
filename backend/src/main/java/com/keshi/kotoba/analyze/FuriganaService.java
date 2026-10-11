package com.keshi.kotoba.analyze;

import com.keshi.kotoba.text.FuriganaNotation;
import com.keshi.kotoba.text.JapaneseReading;
import org.springframework.stereotype.Service;

/**
 * 给日语文本加注音，用 Anki 那套方括号记法。
 *
 * <p>以前是让模型重写整段正文，既花钱，又得防它顺手改字。现在查本地词典
 * （{@link JapaneseReading}），注音是按原文偏移插进去的，正文一个字都不会动。
 */
@Service
public class FuriganaService {

    public FuriganaResult annotate(String text) {
        // 原文里「漢字（かな）」形式的注音先转成方括号 —— 从带 ruby 的网页复制下来的
        // 文本几乎都是这样，那是作者给的读音，比词典猜的准，转过去之后词典不会再动它
        return new FuriganaResult(JapaneseReading.annotate(bracketize(text.strip())));
    }

    /** 「価値（かち）」→「価値[かち]」。只认汉字打头、括号里全是假名的。 */
    static String bracketize(String text) {
        return FuriganaNotation.bracketize(text);
    }
}
