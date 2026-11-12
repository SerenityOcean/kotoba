package com.keshi.kotoba.exam;

import com.keshi.kotoba.exam.ChoiceExamples.Scope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

/** 题目取自 N2 真题讲义里的样子。 */
class ChoiceExamplesTest {

    private static final List<ExamContent.Block> NO_TEXT = List.of();
    private static final List<ExamContent.Block> TEXT =
            List.of(new ExamContent.Block("text", "データを分析するとき", null));

    private static Scope scope(String sectionName, List<ExamContent.Block> blocks, String stem,
                               String... choices) {
        ExamContent.Question question = new ExamContent.Question(1, stem, List.of(), List.of(choices), 1);
        ExamContent.Passage passage = new ExamContent.Passage("", blocks, List.of(question));
        return ChoiceExamples.scope(new ExamContent.Section("", sectionName, List.of(passage)), passage, question);
    }

    @Test
    @DisplayName("读解题一句例句都不要，按大题名认")
    void comprehensionGetsNone() {
        assertEquals(Scope.NONE, scope("短篇阅读", TEXT, "筆者はどのように考えているか。",
                "特徴がみつけやすい", "思い込みが避けられる"));
        assertEquals(Scope.NONE, scope("内容理解（中文）", TEXT, "①⟦もっとよくない⟧とあるが、なぜか。", "一", "二"));
        assertEquals(Scope.NONE, scope("信息检索", TEXT, "参加できるのはどれか。", "Aのみ", "AとD"));
        // 文章の文法 也带本文，但选项是要学的句型
        assertEquals(Scope.ALL, scope("文章の文法", TEXT, "", "多かったのか", "多いのではないか"));
        // 用法 的讲义有时把说明排成了本文
        assertEquals(Scope.ALL, scope("用法", TEXT, "⟦論争（ろんそう）⟧", "⟦論争⟧のため別室に移った。", "⟦論争する⟧ので困る。"));
    }

    @Test
    @DisplayName("没有大题标记的讲义：带本文、题干是完整的问话，才算读解")
    void comprehensionByShapeWhenUnnamed() {
        assertEquals(Scope.NONE, scope("", TEXT, "筆者の考えに合うのはどれか。", "知識を得る努力をしない。", "疑問を感じにくい。"));
        assertEquals(Scope.ALL, scope("", NO_TEXT, "筆者の考えに合うのはどれか。", "一", "二"));
        assertEquals(Scope.ALL, scope("", TEXT, "", "多かったのか", "多いのではないか"));
        assertEquals(Scope.ALL, scope("", TEXT, "大体２日（　　）やってください。", "おきに", "ぶりに"));
        assertEquals(Scope.ALL, scope("", TEXT, "単語を覚える　★　思いついた", "のに", "末に"));
        assertEquals(Scope.ALL, scope("", TEXT, "【41】", "しかし", "つまり"));
        assertEquals(Scope.ALL, scope("", TEXT, "⟦作成⟧", "資料を⟦作成して⟧おく。", "果物を⟦作成する⟧。"));
    }

    @Test
    @DisplayName("読み：画线的是熟语，错误选项是凑出来的读法，只有正确答案留例句")
    void compoundReadingKeepsAnswerOnly() {
        assertEquals(Scope.ANSWER_ONLY, scope("漢字読み", NO_TEXT, "説明を⟦省略⟧してもかまわない。",
                "しょうかく", "しょうらく", "しょうじゃく", "しょうりゃく"));
        // 卷面注过音也一样
        assertEquals(Scope.ANSWER_ONLY, scope("漢字読み", NO_TEXT, "受信[じゅしん]を⟦拒否[きょひ]⟧したい。",
                "きょうひ", "きょうふ", "きょひ", "きょふ"));
        assertEquals(Scope.ANSWER_ONLY, scope("", NO_TEXT, "説明を⟦省略⟧する。", "しょうかく", "しょうりゃく"));
        // 单个汉字、带送假名的词：错误选项是别的真词
        assertEquals(Scope.ALL, scope("漢字読み", NO_TEXT, "⟦針⟧で刺す。", "はり", "くぎ", "ねじ", "かぎ"));
        assertEquals(Scope.ALL, scope("漢字読み", NO_TEXT, "タオルが⟦湿って⟧いる。", "しめって", "にごって"));
        // 言い換え 的选项也可能全是假名，那是真词
        assertEquals(Scope.ALL, scope("言い換え類義", NO_TEXT, "⟦相当⟧迷っている。", "いろいろ", "かなり"));
        assertEquals(Scope.ALL, scope("漢字表記", NO_TEXT, "会場は⟦こんらん⟧していた。", "混乱", "困乱"));
    }

    @Test
    @DisplayName("摘例句：只动不该有的，讲解不动；旧解析的 null 留着；没给答案就认不出该留哪个")
    void prunes() {
        QuestionExplanation explanation = new QuestionExplanation("考点", "因为", List.of(
                new QuestionExplanation.Choice(1, "一", "错", "彼は昇格した。", "他升职了。"),
                new QuestionExplanation.Choice(2, "二", "错", null, null),
                new QuestionExplanation.Choice(4, "四", "对", "説明は省略します。", "说明从略。")));

        QuestionExplanation answerOnly = ChoiceExamples.prune(Scope.ANSWER_ONLY, 4, explanation);
        assertEquals("", answerOnly.choices().get(0).example());
        assertEquals("", answerOnly.choices().get(0).exampleTranslation());
        assertEquals("一", answerOnly.choices().get(0).meaning());
        assertNull(answerOnly.choices().get(1).example(), "要靠 null 认出旧解析重新生成");
        assertEquals("説明は省略します。", answerOnly.choices().get(2).example());

        assertEquals(List.of("", ""), ChoiceExamples.prune(Scope.NONE, 4, explanation).choices().stream()
                .map(QuestionExplanation.Choice::example).filter(e -> e != null).toList());
        assertSame(explanation, ChoiceExamples.prune(Scope.ALL, 4, explanation));
        assertSame(explanation, ChoiceExamples.prune(Scope.ANSWER_ONLY, null, explanation));
    }
}
