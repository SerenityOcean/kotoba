package com.keshi.kotoba.exam;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExplanationServiceTest {

    @Test
    @DisplayName("送给模型的题：带大题类型、本文、选项和答案，注音摘掉")
    void describesQuestionWithoutReadings() {
        ExamContent content = new ExamContent(List.of(), List.of(new ExamContent.Section(
                "問題10", "短篇阅读", List.of(new ExamContent.Passage("本文（1）", List.of(
                        new ExamContent.Block("text", "⟦楽器[がっき]⟧がそろった", null),
                        new ExamContent.Block("note", "誤用[ごよう]：間違った使い方", "注")),
                        List.of(new ExamContent.Question(55, "⟦行事[ぎょうじ]⟧とは", List.of(),
                                List.of("ぎょうじ", "こうじ"), 1)))))));

        String prompt = ExplanationService.describe(content, 55).orElseThrow();

        assertTrue(prompt.contains("大题：問題10　短篇阅读"), prompt);
        assertTrue(prompt.contains("本文（1）：\n"), prompt);
        assertTrue(prompt.contains("⟦楽器⟧がそろった"), prompt);
        assertTrue(prompt.contains("注　誤用：間違った使い方"), prompt);
        assertTrue(prompt.contains("题目：問55　⟦行事⟧とは"), prompt);
        assertTrue(prompt.contains("1. ぎょうじ\n2. こうじ"), prompt);
        assertTrue(prompt.endsWith("正确答案：1"), prompt);
        assertFalse(prompt.contains("["), "注音没摘干净：" + prompt);
        assertTrue(ExplanationService.describe(content, 99).isEmpty());
    }

    @Test
    @DisplayName("模型回的空字段收成空串，选项按序号排")
    void tidiesModelOutput() {
        QuestionExplanation tidy = ExplanationService.tidy(new QuestionExplanation(null, "因为", List.of(
                new QuestionExplanation.Choice(3, "三", ""),
                new QuestionExplanation.Choice(1, "一", ""))));

        assertEquals("", tidy.point());
        assertEquals(List.of(1, 3), tidy.choices().stream().map(QuestionExplanation.Choice::number).toList());
        assertEquals(List.of(), ExplanationService.tidy(new QuestionExplanation("", "", null)).choices());
    }
}
