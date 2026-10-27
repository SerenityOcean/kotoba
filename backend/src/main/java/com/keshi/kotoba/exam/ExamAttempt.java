package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 交一次卷。answers 是 {@code {"55": 3, …}} 的 JSON，没答的题不在里面；
 * 分数交卷时就判好存下，以后卷子的答案改了，这次的成绩也不变。
 */
@Entity
@Table(name = "exam_attempt")
public class ExamAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long examId;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String answers;

    @Column(nullable = false)
    private int correct;

    @Column(nullable = false)
    private int graded;

    @Column(nullable = false)
    private int elapsedSeconds;

    @Column(nullable = false)
    private Instant submittedAt;

    protected ExamAttempt() {
    }

    public ExamAttempt(Long examId, Long ownerId, String answers, int correct, int graded,
                       int elapsedSeconds, Instant submittedAt) {
        this.examId = examId;
        this.ownerId = ownerId;
        this.answers = answers;
        this.correct = correct;
        this.graded = graded;
        this.elapsedSeconds = elapsedSeconds;
        this.submittedAt = submittedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getExamId() {
        return examId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getAnswers() {
        return answers;
    }

    public int getCorrect() {
        return correct;
    }

    public int getGraded() {
        return graded;
    }

    public int getElapsedSeconds() {
        return elapsedSeconds;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }
}
