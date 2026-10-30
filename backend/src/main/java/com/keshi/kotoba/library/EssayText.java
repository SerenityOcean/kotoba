package com.keshi.kotoba.library;

import com.keshi.kotoba.text.FuriganaNotation;

import java.util.Arrays;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 随笔正文的纯文字：摘掉标记和注音之后算字数、截摘要。标记的写法见 {@link LibraryEssay}，
 * 前端的 library/essay-markup.ts 是同一套，两边改要一起改。
 */
final class EssayText {

    /** 中文一分钟大约读这么多字。 */
    static final int CHARS_PER_MINUTE = 400;

    private static final Pattern FOOTNOTE_REF = Pattern.compile("\\[\\^[^\\]]+]");
    private static final Pattern SPACES = Pattern.compile("\\s+");

    private EssayText() {
    }

    /** 读者看得到的字：去掉小标题记号、引文记号、例句块的围栏、旁注的定义和引用、注音。 */
    static String plain(String body) {
        String text = Arrays.stream(body.split("\n"))
                .map(String::strip)
                .filter(line -> !line.startsWith(":::") && !line.equals("---") && !line.matches("\\[\\^[^\\]]+]:.*"))
                .map(line -> line.replaceFirst("^(##|>)\\s*", ""))
                .collect(Collectors.joining("\n"));
        return FuriganaNotation.strip(FOOTNOTE_REF.matcher(text).replaceAll(""));
    }

    static int chars(String body) {
        return SPACES.matcher(plain(body)).replaceAll("").length();
    }

    static int minutes(int chars) {
        return Math.max(1, (chars + CHARS_PER_MINUTE - 1) / CHARS_PER_MINUTE);
    }

    /**
     * 开头一段正文，超过 max 字就截断加省略号。随笔一行一段，所以取第一行正文；
     * 小标题、引文、例句块里的行、旁注定义都跳过。资料包里的日语文章也用它（那边是空行分段，一样取第一行）。
     */
    static String excerpt(String body, int max) {
        boolean inExample = false;
        for (String raw : body.split("\n")) {
            String line = raw.strip();
            if (line.startsWith(":::")) {
                inExample = !inExample;
                continue;
            }
            if (inExample || line.isEmpty() || line.startsWith("##") || line.startsWith(">")
                    || line.matches("\\[\\^[^\\]]+]:.*")) {
                continue;
            }
            String first = SPACES.matcher(plain(line)).replaceAll("");
            if (!first.isEmpty()) {
                return first.length() <= max ? first : first.substring(0, max) + "…";
            }
        }
        return "";
    }
}
