package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 给一道题标的难度：1 简单、2 一般、3 难。一题最多一行，再标就是改。
 * 卷子本身就分了人，这里不再存 owner。
 */
@Entity
@Table(name = "exam_mark")
public class ExamMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long examId;

    @Column(nullable = false)
    private int questionNumber;

    @Column(nullable = false)
    private short level;

    @Column(nullable = false)
    private Instant markedAt;

    protected ExamMark() {
    }

    public ExamMark(Long examId, int questionNumber, int level, Instant markedAt) {
        this.examId = examId;
        this.questionNumber = questionNumber;
        this.level = (short) level;
        this.markedAt = markedAt;
    }

    public int getQuestionNumber() {
        return questionNumber;
    }

    public int getLevel() {
        return level;
    }

    public void mark(int level, Instant markedAt) {
        this.level = (short) level;
        this.markedAt = markedAt;
    }
}
