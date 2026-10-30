package com.keshi.kotoba.library;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * 兑换码的样子：12 位，四个一组用横线隔开（K7QM-3XRP-WN9D）。
 * 字母表去掉了 0 O 1 I L 这些容易看错的；存的时候不带横线、全大写，
 * 用户输小写、少了横线、多了空格都认。
 */
final class RedeemCodes {

    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final int LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private RedeemCodes() {
    }

    static String generate() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    static String normalize(String raw) {
        return raw == null ? "" : raw.replaceAll("[^0-9A-Za-z]", "").toUpperCase(Locale.ROOT);
    }

    /** 给人看的样子。 */
    static String format(String code) {
        return String.join("-", code.substring(0, 4), code.substring(4, 8), code.substring(8));
    }
}
