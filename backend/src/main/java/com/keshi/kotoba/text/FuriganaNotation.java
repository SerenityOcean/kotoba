package com.keshi.kotoba.text;

import java.util.regex.Pattern;

/**
 * Anki 那套方括号注音记法：{@code 諦[あきら]める}。
 *
 * <p>拆解、注音、文章摘要都要处理它，所以放在这儿共用 —— 底字只认汉字，
 * 和前端 Furigana 组件的规则必须一致，两边改要一起改。
 */
public final class FuriganaNotation {

    private static final Pattern RUBY =
            Pattern.compile("([\\u4e00-\\u9fff々〆ヶ]+)\\[([^\\[\\]]+)\\]");

    /**
     * 汉字后面紧跟一对括号、里面全是假名 —— 这是注音，不是正常的括号内容。
     * 从带 ruby 的网页复制下来的文本常是这个样子。
     */
    private static final Pattern PAREN_READING =
            Pattern.compile("([\\u4e00-\\u9fff々〆ヶ]+)[（(]([\\u3041-\\u309f\\u30a1-\\u30ff]+)[）)]");

    private FuriganaNotation() {
    }

    /** 去掉注音，留下底字。 */
    public static String strip(String annotated) {
        return RUBY.matcher(annotated).replaceAll("$1");
    }

    /** 「価値（かち）」→「価値[かち]」。只认汉字打头、括号里全是假名的。 */
    public static String bracketize(String text) {
        return PAREN_READING.matcher(text).replaceAll("$1[$2]");
    }
}
