package com.keshi.kotoba.exam;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ExamGradingTest {

    private static ExamContent.Question question(int number, Integer answer) {
        return new ExamContent.Question(number, "問", List.of(), List.of("1", "2", "3", "4"), answer);
    }

    private static final ExamContent CONTENT = new ExamContent(List.of(), List.of(
            new ExamContent.Section("問題10", "短篇阅读", List.of(
                    new ExamContent.Passage("本文（1）", List.of(), List.of(question(55, 3), question(56, 4))),
                    new ExamContent.Passage("本文（2）", List.of(), List.of(question(57, null))))),
            new ExamContent.Section("問題11", "中篇阅读", List.of(
                    new ExamContent.Passage("本文", List.of(), List.of(question(58, 1)))))));

    @Test
    @DisplayName("没答案的题不计分，没作答的算错")
    void gradesOnlyQuestionsWithAnswers() {
        ExamService.Graded graded = ExamService.grade(CONTENT, Map.of(55, 3, 56, 1, 57, 2));

        assertEquals(1, graded.correct());
        assertEquals(3, graded.graded());
        assertEquals(Map.of(55, 3, 56, 1, 57, 2), graded.answers());
    }

    @Test
    @DisplayName("卷子里没有的题号、超出选项的答案不收")
    void dropsAnswersOutsideTheExam() {
        ExamService.Graded graded = ExamService.grade(CONTENT, Map.of(58, 1, 99, 1, 55, 5));

        assertEquals(1, graded.correct());
        assertEquals(Map.of(58, 1), graded.answers());
    }
}
