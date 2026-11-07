package com.keshi.kotoba.exam;

import com.keshi.kotoba.text.FuriganaNotation;
import com.keshi.kotoba.text.JapaneseReading;

import java.util.List;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 在后端给整份卷子注音：资料包里的卷子是主人上传时注的，不经过前端的 annotateExam。
 * 注哪些字、漢字题去掉哪些音，和前端 exam.ts 的 mapTexts / hideAnswerReadings 一致，两边改要一起改。
 */
public final class ExamFurigana {

    /** 漢字読み、漢字表記：下线部和选项的注音就是答案 */
    private static final Pattern KANJI_SECTION = Pattern.compile("漢字");

    /** 前端 exam.ts 的 UNDERLINE_OPEN / UNDERLINE_CLOSE */
    private static final Pattern UNDERLINED = Pattern.compile("⟦[^⟧]*⟧");

    private ExamFurigana() {
    }

    public static ExamContent annotate(ExamContent content) {
        // 一行一行注：题干、本文里的换行原样留着，行首的全角空格也不会被 strip 掉
        UnaryOperator<String> annotate = text -> String.join("\n", text.lines()
                .map(line -> JapaneseReading.annotate(FuriganaNotation.bracketize(line)))
                .toList());
        return new ExamContent(content.preface(), content.sections().stream()
                .map(section -> {
                    boolean kanji = KANJI_SECTION.matcher(section.name()).find();
                    return new ExamContent.Section(section.label(), section.name(), section.passages().stream()
                            .map(passage -> new ExamContent.Passage(passage.label(),
                                    passage.blocks().stream()
                                            .map(b -> b.kind().equals("part") ? b
                                                    : new ExamContent.Block(b.kind(), annotate.apply(b.text()), b.mark()))
                                            .toList(),
                                    passage.questions().stream()
                                            .map(q -> question(q, annotate, kanji))
                                            .toList()))
                            .toList());
                })
                .toList());
    }

    private static ExamContent.Question question(ExamContent.Question q, UnaryOperator<String> annotate,
                                                 boolean kanji) {
        String stem = annotate.apply(q.stem());
        List<String> choices = q.choices().stream().map(annotate).toList();
        if (kanji) {
            stem = stripUnderlined(stem);
            choices = choices.stream().map(FuriganaNotation::strip).toList();
        }
        return new ExamContent.Question(q.number(), stem, q.extra().stream().map(annotate).toList(),
                choices, q.answer());
    }

    private static String stripUnderlined(String text) {
        Matcher m = UNDERLINED.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(out, Matcher.quoteReplacement(FuriganaNotation.strip(m.group())));
        }
        return m.appendTail(out).toString();
    }
}
