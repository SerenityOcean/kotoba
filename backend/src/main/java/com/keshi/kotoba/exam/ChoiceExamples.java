package com.keshi.kotoba.exam;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 一道题的哪些选项该带例句。光在提示词里说「造不出就写空串」模型不听，每个选项都硬凑一句，
 * 所以按题型在这边定死：告诉模型别写，写了也摘掉。存下的旧解析给出去之前过同一遍，
 * 不用重新生成。
 *
 * <ul>
 *   <li>读解题：选项是对本文的概括，不是要学的词，一句都不要。</li>
 *   <li>漢字読み，画线的是两个字以上的熟语（「省略」）：错误选项是换了一个字的读法凑出来的
 *       （しょうかく、しょうらく），不是词，只有正确答案留例句。画线的是单个汉字或带送假名的词
 *       （「針」「湿って」）时，错误选项是别的真词，照旧各造一句。</li>
 *   <li>其余题型不管，由模型按提示词判断。</li>
 * </ul>
 */
final class ChoiceExamples {

    /** 哪些选项留例句 */
    enum Scope {
        /** 每个选项都可以有 */
        ALL,
        /** 只有正确答案 */
        ANSWER_ONLY,
        /** 都不要 */
        NONE
    }

    /** 大题名里有这些就是读解。讲义里中文、日文两种叫法都有 */
    private static final Pattern COMPREHENSION =
            Pattern.compile("阅读|閲読|読解|读解|内容理解|主張理解|統合理解|情報検索|信息检索");

    /** 题干里要填的空：（　）、★、【41】、下划线。有空的是语法、词汇题，不是读解 */
    private static final Pattern BLANK =
            Pattern.compile("[（(][\\s　]*[）)]|★|【[\\s　]*\\d+[\\s　]*】|[_＿]{2,}");

    private static final Pattern UNDERLINED = Pattern.compile("⟦([^⟧]*)⟧");

    private static final Pattern RUBY = Pattern.compile("\\[[^\\[\\]]*\\]");

    private static final Pattern COMPOUND = Pattern.compile("[\\u4E00-\\u9FFF々〆ヶ]{2,}");

    private static final Pattern KANA = Pattern.compile("[\\u3040-\\u30FF\\s　]+");

    private ChoiceExamples() {
    }

    static Scope scope(ExamContent.Section section, ExamContent.Passage passage,
                       ExamContent.Question question) {
        if (comprehension(section, passage, question)) {
            return Scope.NONE;
        }
        return compoundReading(section, question) ? Scope.ANSWER_ONLY : Scope.ALL;
    }

    /**
     * 按卷面上的题型摘掉不该有的例句。还没有例句字段的旧解析（example 是 null）原样留着，
     * 它要靠 null 被认出来重新生成。
     */
    static QuestionExplanation prune(ExamContent content, int number, QuestionExplanation explanation) {
        if (explanation.choices() == null) {
            return explanation;
        }
        for (ExamContent.Section section : content.sections()) {
            for (ExamContent.Passage passage : section.passages()) {
                for (ExamContent.Question question : passage.questions()) {
                    if (question.number() == number) {
                        return prune(scope(section, passage, question), question.answer(), explanation);
                    }
                }
            }
        }
        return explanation;
    }

    static QuestionExplanation prune(Scope scope, Integer answer, QuestionExplanation explanation) {
        // 讲义没给答案的题，正确选项是模型自己判断的，这边认不出哪个该留
        if (scope == Scope.ALL || (scope == Scope.ANSWER_ONLY && answer == null)) {
            return explanation;
        }
        List<QuestionExplanation.Choice> choices = explanation.choices().stream()
                .map(choice -> choice.example() == null || choice.example().isEmpty()
                        || (scope == Scope.ANSWER_ONLY && choice.number() == answer)
                        ? choice
                        : new QuestionExplanation.Choice(choice.number(), choice.meaning(), choice.verdict(), "", ""))
                .toList();
        return new QuestionExplanation(explanation.point(), explanation.reason(), choices);
    }

    /**
     * 读解题吗。有大题名的看名字；没有大题标记的讲义看样子：带本文、题干是一句完整的问话
     * （没有要填的空）、选项里也没有画线。
     */
    private static boolean comprehension(ExamContent.Section section, ExamContent.Passage passage,
                                         ExamContent.Question question) {
        if (!section.name().isBlank()) {
            return COMPREHENSION.matcher(section.name()).find();
        }
        return !passage.blocks().isEmpty()
                && !question.stem().isBlank()
                && !BLANK.matcher(question.stem()).find()
                && question.choices().stream().noneMatch(choice -> choice.contains("⟦"));
    }

    /**
     * 漢字読み、而且画线的是两个字以上的熟语吗。有大题名的看名字里有没有「読み」；
     * 没有的看样子：题干只画了一处线，选项全是假名（言い換え 的选项也可能全是假名，
     * 所以有名字时不看样子）。
     */
    private static boolean compoundReading(ExamContent.Section section, ExamContent.Question question) {
        if (question.choices().isEmpty()
                || !question.choices().stream().allMatch(choice -> KANA.matcher(choice.strip()).matches())) {
            return false;
        }
        if (!section.name().isBlank() && !section.name().contains("読み") && !section.name().contains("读音")) {
            return false;
        }
        Matcher underlined = UNDERLINED.matcher(RUBY.matcher(question.stem()).replaceAll(""));
        if (!underlined.find()) {
            return false;
        }
        String target = underlined.group(1).strip();
        return COMPOUND.matcher(target).matches() && !underlined.find();
    }
}
