package com.keshi.kotoba.text;

import org.apache.lucene.analysis.ja.JapaneseTokenizer;
import org.apache.lucene.analysis.ja.tokenattributes.PartOfSpeechAttribute;
import org.apache.lucene.analysis.ja.tokenattributes.ReadingAttribute;
import org.apache.lucene.analysis.tokenattributes.CharTermAttribute;
import org.apache.lucene.analysis.tokenattributes.OffsetAttribute;

import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 用 Kuromoji（IPADIC 词典）给日语加注音，输出 {@link FuriganaNotation} 的方括号记法。
 *
 * <p>在本地分词，不花钱，也不会改字 —— 输出是按原文的偏移一段段拼回去的，
 * 剥掉注音一定和原文一字不差。拿卡片库实测过：单词读音 99%，例句逐词约 98%。
 * 剩下错的主要是两类：数字 + 量词（词典把「一人」切成 一/人，各读 いち・にん），
 * 由 {@link Counters} 补；本身就有歧义的（抱く だく/いだく、後 あと/のち），
 * 分词器只能挑常见的那个，这个没法修。
 */
public final class JapaneseReading {

    private static final String KANJI = "\\u4e00-\\u9fff々〆ヶ";

    private static final Pattern HAS_KANJI = Pattern.compile("[" + KANJI + "]");

    /** 把一个词切成汉字段和非汉字段：「取り消す」→ 取 / り / 消 / す。 */
    private static final Pattern KANJI_OR_NOT = Pattern.compile("[" + KANJI + "]+|[^" + KANJI + "]+");

    /**
     * IPADIC 里已知的错读，按写法开头纠正。預ける 词典里是旧写法 あづける，
     * 出口 单独出现时会被当成姓氏 いでぐち，夜中 在句子里常被读成 やちゅう。
     */
    private static final List<Misread> MISREADS = List.of(
            new Misread("預", "アヅ", "アズ"),
            new Misread("入り口", "イリクチ", "イリグチ"),
            new Misread("出口", "イデグチ", "デグチ"),
            new Misread("夜中", "ヤチュウ", "ヨナカ"));

    private JapaneseReading() {
    }

    /**
     * 给没注音的汉字补上注音。已经是「漢字[よみ]」的原样留着，查不到读音的词也原样留着 ——
     * 宁可少注一个，不注错。
     */
    public static String annotate(String text) {
        StringBuilder out = new StringBuilder(text.length() * 2);
        Matcher annotated = FuriganaNotation.RUBY.matcher(text);
        int cursor = 0;
        while (annotated.find()) {
            out.append(annotatePlain(text.substring(cursor, annotated.start())));
            out.append(annotated.group());
            cursor = annotated.end();
        }
        out.append(annotatePlain(text.substring(cursor)));
        return out.toString();
    }

    /** 片假名 → 平假名。长音、中点不动。 */
    public static String toHiragana(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            out.append(c >= 'ァ' && c <= 'ヶ' ? (char) (c - 0x60) : c);
        }
        return out.toString();
    }

    private static String annotatePlain(String text) {
        if (!HAS_KANJI.matcher(text).find()) {
            return text;
        }
        List<Morpheme> morphemes = tokenize(text);
        Counters.adjust(morphemes);

        StringBuilder out = new StringBuilder(text.length() * 2);
        int cursor = 0;
        for (Morpheme m : morphemes) {
            out.append(text, cursor, m.start);
            out.append(ruby(m.surface, m.reading));
            cursor = m.end;
        }
        out.append(text, cursor, text.length());
        return out.toString();
    }

    private static List<Morpheme> tokenize(String text) {
        List<Morpheme> morphemes = new ArrayList<>();
        // 分词器不是线程安全的，每次新建；词典是全局单例，只在第一次用时加载
        try (JapaneseTokenizer tokenizer =
                     new JapaneseTokenizer(null, false, JapaneseTokenizer.Mode.NORMAL)) {
            CharTermAttribute term = tokenizer.addAttribute(CharTermAttribute.class);
            ReadingAttribute reading = tokenizer.addAttribute(ReadingAttribute.class);
            PartOfSpeechAttribute pos = tokenizer.addAttribute(PartOfSpeechAttribute.class);
            OffsetAttribute offset = tokenizer.addAttribute(OffsetAttribute.class);

            tokenizer.setReader(new StringReader(text));
            tokenizer.reset();
            while (tokenizer.incrementToken()) {
                String surface = term.toString();
                morphemes.add(new Morpheme(surface, readingOf(surface, reading.getReading()),
                        pos.getPartOfSpeech(), offset.startOffset(), offset.endOffset()));
            }
            tokenizer.end();
        } catch (IOException e) {
            // 读的是内存里的字符串，不会真的发生
            throw new UncheckedIOException(e);
        }
        return morphemes;
    }

    /** 词典给的片假名读音，纠正已知错读后转成平假名。词典里没有的词是 null。 */
    private static String readingOf(String surface, String reading) {
        if (reading == null) {
            return null;
        }
        for (Misread fix : MISREADS) {
            if (surface.startsWith(fix.surface()) && reading.startsWith(fix.wrong())) {
                reading = fix.right() + reading.substring(fix.wrong().length());
            }
        }
        return toHiragana(reading);
    }

    /**
     * 一个词的注音：送り仮名留在外面，只给汉字段注音 ——
     * 「取り消す」+ とりけす → 取[と]り消[け]す。
     * 读音和词里的假名对不上（词典读音怪，或者假名写法不同）就不注。
     */
    static String ruby(String surface, String reading) {
        if (reading == null || !HAS_KANJI.matcher(surface).find()) {
            return surface;
        }
        List<String> parts = new ArrayList<>();
        StringBuilder pattern = new StringBuilder();
        Matcher m = KANJI_OR_NOT.matcher(surface);
        while (m.find()) {
            parts.add(m.group());
            pattern.append(isKanji(m.group()) ? "(.+?)" : Pattern.quote(toHiragana(m.group())));
        }

        Matcher aligned = Pattern.compile(pattern.toString()).matcher(toHiragana(reading));
        if (!aligned.matches()) {
            return surface;
        }
        StringBuilder out = new StringBuilder();
        int group = 1;
        for (String part : parts) {
            out.append(part);
            if (isKanji(part)) {
                out.append('[').append(aligned.group(group++)).append(']');
            }
        }
        return out.toString();
    }

    private static boolean isKanji(String part) {
        return HAS_KANJI.matcher(part.substring(0, 1)).matches();
    }

    private record Misread(String surface, String wrong, String right) {
    }

    /** 分出来的一个词。读音是平假名，{@link Counters} 会改它，也会把几个词并成一个。 */
    static final class Morpheme {
        final String surface;
        String reading;
        final String partOfSpeech;
        final int start;
        final int end;

        Morpheme(String surface, String reading, String partOfSpeech, int start, int end) {
            this.surface = surface;
            this.reading = reading;
            this.partOfSpeech = partOfSpeech;
            this.start = start;
            this.end = end;
        }
    }
}
