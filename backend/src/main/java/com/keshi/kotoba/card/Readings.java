package com.keshi.kotoba.card;

import com.keshi.kotoba.text.FuriganaNotation;

import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 卡片读音：哪些卡值得打字、读音从哪儿猜、用户填的读音怎么收。
 *
 * <p>猜的时候只用确定的信息 —— 正面的注音、背面开头那串假名。
 * 猜不出来就留空，交给「补读音」去问模型，或者用户自己填。
 */
final class Readings {

    /** 读音里能出现的字：平假名、片假名、长音、重复符号、中点。 */
    private static final String KANA_CHARS = "ぁ-ゖァ-ヺーゝゞヽヾ・";

    private static final Pattern KANA = Pattern.compile("[" + KANA_CHARS + "]+");

    private static final Pattern KANJI = Pattern.compile("[\\u4e00-\\u9fff々〆ヶ]");

    /** 几个读音之间的分隔，全角半角斜线都认。 */
    private static final Pattern SEPARATOR = Pattern.compile("\\s*[／/]\\s*");

    /** 背面开头的读音：一串假名，后面跟空白、括号、竖线、标点，或者就此结束。 */
    private static final Pattern BACK_PREFIX = Pattern.compile(
            "^\\s*([" + KANA_CHARS + "]+)(?=[\\s　（(｜|／/,，、:：;；]|$)");

    /** 再长就是短语或句子了，打字考读音没意义。 */
    static final int MAX_FRONT_LENGTH = 12;

    private Readings() {
    }

    /**
     * 这张卡值得考读音吗：正面有汉字、不长、不是句子也不是「〜てしまう」这种句型。
     * 全是假名的打一遍等于照抄，也不考。
     */
    static boolean wanted(String front) {
        String plain = FuriganaNotation.strip(front).strip();
        return !plain.isEmpty()
                && plain.length() <= MAX_FRONT_LENGTH
                && KANJI.matcher(plain).find()
                && !plain.matches(".*[\\s。、，,！!？?〜～…].*");
    }

    /** 先看正面的注音，再看背面开头。都不行就是 null。 */
    static String guess(String front, String back) {
        if (!wanted(front)) {
            return null;
        }
        String fromFront = fromAnnotated(front);
        return fromFront != null ? fromFront : fromBack(front, back);
    }

    /** 正面每个汉字都注了音，就能拼出整个读音：{@code 食[た]べる} → たべる。 */
    static String fromAnnotated(String annotated) {
        String reading = FuriganaNotation.reading(annotated).strip();
        return isKana(reading) ? reading : null;
    }

    /**
     * Anki 词汇包常见的写法：背面开头就是读音，「はんだん 名詞 判断…」。
     * 还要和正面的送り仮名对得上（戻す ↔ もどす 都以「す」结尾），
     * 免得把背面开头一个碰巧是假名的词当成读音。
     */
    static String fromBack(String front, String back) {
        if (back == null) {
            return null;
        }
        Matcher m = BACK_PREFIX.matcher(back);
        if (!m.find()) {
            return null;
        }
        String reading = m.group(1);
        return fits(FuriganaNotation.strip(front).strip(), reading) ? reading : null;
    }

    /** 读音的头尾假名要和正面的头尾假名一致，长度也不能比汉字还短。 */
    static boolean fits(String plainFront, String reading) {
        String front = toHiragana(plainFront);
        String r = toHiragana(reading);
        Matcher lead = Pattern.compile("^[" + KANA_CHARS + "]*").matcher(front);
        Matcher tail = Pattern.compile("[" + KANA_CHARS + "]*$").matcher(front);
        String leading = lead.find() ? lead.group() : "";
        String trailing = tail.find() ? tail.group() : "";
        return r.length() >= front.length() - leading.length() - trailing.length()
                && r.startsWith(leading)
                && r.endsWith(trailing);
    }

    /**
     * 收用户填的读音：去掉首尾空白，斜线统一成 ／。留空就是 null。
     *
     * @throws IllegalArgumentException 里面有假名以外的字
     */
    static String normalize(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String joined = Arrays.stream(SEPARATOR.split(input.strip()))
                .filter(part -> !part.isEmpty())
                .collect(Collectors.joining("／"));
        for (String part : joined.split("／")) {
            if (!isKana(part)) {
                throw new IllegalArgumentException("读音只能写假名：" + part);
            }
        }
        return joined.isEmpty() ? null : joined;
    }

    static boolean isKana(String text) {
        return !text.isEmpty() && KANA.matcher(text).matches();
    }

    /** 片假名 → 平假名，比较头尾送り仮名时用。长音、中点不动。 */
    static String toHiragana(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            out.append(c >= 'ァ' && c <= 'ヶ' ? (char) (c - 0x60) : c);
        }
        return out.toString();
    }
}
