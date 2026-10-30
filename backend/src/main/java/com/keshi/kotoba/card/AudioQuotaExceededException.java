package com.keshi.kotoba.card;

/** 录音占的空间到每人的上限了。 */
public class AudioQuotaExceededException extends RuntimeException {

    public AudioQuotaExceededException(long quotaMb) {
        super("录音空间用完了（每人 " + quotaMb + " MB）");
    }
}
