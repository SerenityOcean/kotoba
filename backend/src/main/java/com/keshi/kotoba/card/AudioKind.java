package com.keshi.kotoba.card;

import java.util.Locale;

/** 卡片自带的哪一段录音。 */
public enum AudioKind {

    /** 单词读音：打字答对时自动放 */
    WORD,

    /** 例句：例句后面的喇叭，点了才放 */
    SENTENCE;

    /** 路径和上传时用小写：/api/cards/3/audio/word。 */
    static AudioKind parse(String value) {
        try {
            return valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("录音只有 word 和 sentence 两种");
        }
    }
}
