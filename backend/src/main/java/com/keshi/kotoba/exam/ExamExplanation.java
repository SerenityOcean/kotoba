package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** 存下的一道题的解析。content 是 {@link QuestionExplanation} 的 JSON。 */
@Entity
@Table(name = "exam_explanation")
public class ExamExplanation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long examId;

    @Column(nullable = false)
    private int questionNumber;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, columnDefinition = "text")
    private String model;

    @Column(nullable = false)
    private Instant createdAt;

    protected ExamExplanation() {
    }

    public ExamExplanation(Long examId, int questionNumber, String content, String model,
                           Instant createdAt) {
        this.examId = examId;
        this.questionNumber = questionNumber;
        this.content = content;
        this.model = model;
        this.createdAt = createdAt;
    }

    public int getQuestionNumber() {
        return questionNumber;
    }

    public String getContent() {
        return content;
    }
}
