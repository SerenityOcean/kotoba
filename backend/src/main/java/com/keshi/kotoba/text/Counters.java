package com.keshi.kotoba.text;

import com.keshi.kotoba.text.JapaneseReading.Morpheme;

import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * 数字 + 量词的读音。IPADIC 把数字一个字一个字切开、量词单独成词，
 * 各给默认读音：一人 → いち・にん，一杯 → いち・はい。连读时的变化 ——
 * ひとり、いっぱい、さんぼん、さんびゃく —— 在这里补上。
 *
 * <p>只认汉字数字。「1人」这种阿拉伯数字的，数字本身注不了音（底字只认汉字），
 * 量词也就照默认读。
 */
final class Counters {

    private static final String NUMERALS = "〇一二三四五六七八九十百千万何";

    private static final String NUMERAL_POS = "名詞-数";

    private static final String COUNTER_POS = "名詞-接尾-助数詞";

    /** 整串另读、拆不开的。key 是数字连同量词。 */
    private static final Map<String, String> WHOLE = Map.of(
            "二十日", "はつか",
            "二十歳", "はたち");

    /**
     * 数字和量词各换一个读音的。key 是最后一个数字加量词。
     * standaloneOnly 的只在前面没别的数字时算数：一人 ひとり，但 十一人 是 じゅういちにん；
     * 四人 よにん 不受限，十四人 也是 じゅうよにん。
     */
    private static final Map<String, Special> SPECIAL = Map.ofEntries(
            entry("一人", new Special("ひと", "り", true)),
            entry("二人", new Special("ふた", "り", true)),
            entry("四人", new Special("よ", "にん", false)),
            entry("二日", new Special("ふつ", "か", true)),
            entry("三日", new Special("みっ", "か", true)),
            entry("四日", new Special("よっ", "か", false)),
            entry("五日", new Special("いつ", "か", true)),
            entry("六日", new Special("むい", "か", true)),
            entry("七日", new Special("なの", "か", true)),
            entry("八日", new Special("よう", "か", true)),
            entry("九日", new Special("ここの", "か", true)),
            entry("十日", new Special("とお", "か", true)),
            entry("四時", new Special("よ", "じ", false)),
            entry("七時", new Special("しち", "じ", false)),
            entry("九時", new Special("く", "じ", false)),
            entry("四時間", new Special("よ", "じかん", false)),
            entry("九時間", new Special("く", "じかん", false)),
            entry("四年", new Special("よ", "ねん", false)),
            entry("四円", new Special("よ", "えん", false)),
            entry("一口", new Special("ひと", "くち", true)),
            entry("一言", new Special("ひと", "こと", true)),
            entry("一晩", new Special("ひと", "ばん", true)));

    private static final String K_ROW = "一六八十百";
    private static final String S_ROW = "一八十";

    /** 量词开头的音变：哪些数字后面促音化、促音后量词怎么读、哪些数字后面浊化。 */
    private static final Map<String, Rule> RULES = Map.ofEntries(
            entry("回", new Rule(K_ROW, null, "", null)),
            entry("個", new Rule(K_ROW, null, "", null)),
            entry("課", new Rule(K_ROW, null, "", null)),
            entry("曲", new Rule(K_ROW, null, "", null)),
            entry("件", new Rule(K_ROW, null, "", null)),
            entry("巻", new Rule(K_ROW, null, "", null)),
            entry("か月", new Rule(K_ROW, null, "", null)),
            entry("ヶ月", new Rule(K_ROW, null, "", null)),
            entry("カ月", new Rule(K_ROW, null, "", null)),
            entry("か所", new Rule(K_ROW, null, "", null)),
            entry("ヶ所", new Rule(K_ROW, null, "", null)),
            entry("箇所", new Rule(K_ROW, null, "", null)),
            entry("階", new Rule(K_ROW, null, "三何", "がい")),
            entry("軒", new Rule(K_ROW, null, "三何", "げん")),
            entry("冊", new Rule(S_ROW, null, "", null)),
            entry("歳", new Rule(S_ROW, null, "", null)),
            entry("才", new Rule(S_ROW, null, "", null)),
            entry("週", new Rule(S_ROW, null, "", null)),
            entry("週間", new Rule(S_ROW, null, "", null)),
            entry("通", new Rule(S_ROW, null, "", null)),
            entry("頭", new Rule(S_ROW, null, "", null)),
            entry("着", new Rule(S_ROW, null, "", null)),
            entry("足", new Rule(S_ROW, null, "三何", "ぞく")),
            entry("本", new Rule(K_ROW, "ぽん", "三何千万", "ぼん")),
            entry("杯", new Rule(K_ROW, "ぱい", "三何千万", "ばい")),
            entry("匹", new Rule(K_ROW, "ぴき", "三何千万", "びき")),
            entry("分", new Rule(K_ROW, "ぷん", "三四何", "ぷん")),
            entry("分間", new Rule(K_ROW, "ぷんかん", "三四何", "ぷんかん")),
            entry("泊", new Rule(K_ROW, "ぱく", "三四何", "ぱく")),
            entry("発", new Rule(K_ROW, "ぱつ", "三四何", "ぱつ")),
            entry("歩", new Rule(K_ROW, "ぽ", "三何", "ぽ")));

    private Counters() {
    }

    /** 找出连着的数字（后面可能跟一个量词），把读音改对。可能把几个词并成一个。 */
    static void adjust(List<Morpheme> morphemes) {
        for (int i = 0; i < morphemes.size(); i++) {
            if (!isNumeral(morphemes.get(i))) {
                continue;
            }
            int first = i;
            while (i + 1 < morphemes.size() && isNumeral(morphemes.get(i + 1))
                    && adjacent(morphemes.get(i), morphemes.get(i + 1))) {
                i++;
            }
            List<Morpheme> run = morphemes.subList(first, i + 1);
            adjustNumber(run);

            if (i + 1 < morphemes.size() && isCounter(morphemes.get(i + 1))
                    && adjacent(morphemes.get(i), morphemes.get(i + 1))) {
                if (adjustCounter(morphemes, first, i + 1)) {
                    i = first;
                }
            }
        }
    }

    /** 数字内部的音变：三百 さんびゃく、六百 ろっぴゃく、三千 さんぜん、八千 はっせん。 */
    private static void adjustNumber(List<Morpheme> run) {
        for (int j = 1; j < run.size(); j++) {
            Morpheme prev = run.get(j - 1);
            Morpheme cur = run.get(j);
            switch (cur.surface) {
                case "百" -> {
                    if ("三何".contains(prev.surface)) {
                        cur.reading = "びゃく";
                    } else if ("六八".contains(prev.surface)) {
                        prev.reading = geminate(prev.reading);
                        cur.reading = "ぴゃく";
                    }
                }
                case "千" -> {
                    if ("三何".contains(prev.surface)) {
                        cur.reading = "ぜん";
                    } else if ("八".equals(prev.surface)) {
                        prev.reading = geminate(prev.reading);
                    }
                }
                default -> {
                }
            }
        }
    }

    /**
     * 数字 morphemes[first, counter) 后面跟着量词 morphemes[counter]。
     *
     * @return 是不是把它们并成了一个词
     */
    private static boolean adjustCounter(List<Morpheme> morphemes, int first, int counterIndex) {
        List<Morpheme> run = morphemes.subList(first, counterIndex);
        Morpheme last = run.getLast();
        Morpheme counter = morphemes.get(counterIndex);

        StringBuilder number = new StringBuilder();
        run.forEach(m -> number.append(m.surface));
        String whole = WHOLE.get(number + counter.surface);
        if (whole != null) {
            Morpheme merged = new Morpheme(number + counter.surface, whole, COUNTER_POS,
                    run.getFirst().start, counter.end);
            morphemes.subList(first, counterIndex + 1).clear();
            morphemes.add(first, merged);
            return true;
        }

        Special special = SPECIAL.get(last.surface + counter.surface);
        if (special != null && (!special.standaloneOnly() || run.size() == 1)) {
            last.reading = special.numeral();
            counter.reading = special.counter();
            return false;
        }

        Rule rule = RULES.get(counter.surface);
        if (rule == null) {
            return false;
        }
        if (rule.geminatedBy().contains(last.surface)) {
            last.reading = geminate(last.reading);
            if (rule.afterGeminate() != null) {
                counter.reading = rule.afterGeminate();
            }
        } else if (rule.voicedBy().contains(last.surface)) {
            counter.reading = rule.voiced();
        }
        return false;
    }

    /** いち → いっ、ろく → ろっ、じゅう → じゅっ、びゃく → びゃっ。 */
    private static String geminate(String reading) {
        if (reading.endsWith("じゅう")) {
            return reading.substring(0, reading.length() - 1) + "っ";
        }
        if (reading.endsWith("く") || reading.endsWith("ち")) {
            return reading.substring(0, reading.length() - 1) + "っ";
        }
        return reading;
    }

    private static boolean isNumeral(Morpheme m) {
        return m.reading != null && m.surface.length() == 1 && NUMERALS.contains(m.surface)
                && m.partOfSpeech != null && m.partOfSpeech.startsWith(NUMERAL_POS);
    }

    private static boolean isCounter(Morpheme m) {
        return m.reading != null && COUNTER_POS.equals(m.partOfSpeech);
    }

    private static boolean adjacent(Morpheme a, Morpheme b) {
        return a.end == b.start;
    }

    private record Special(String numeral, String counter, boolean standaloneOnly) {
    }

    /**
     * @param geminatedBy   后面跟这个量词时会促音化的数字
     * @param afterGeminate 促音化之后量词的读音（本 → ぽん）；null 表示不变
     * @param voicedBy      后面跟这个量词时量词会浊化 / 半浊化的数字
     * @param voiced        那时量词的读音
     */
    private record Rule(String geminatedBy, String afterGeminate, String voicedBy, String voiced) {
    }
}
