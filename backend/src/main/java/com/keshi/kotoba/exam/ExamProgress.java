package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 一份卷子做到哪儿了：选了的答案、走了多久、这一遍做完记下的是哪次成绩。
 * 一份卷子一行，主键就是卷子的 id，再存就是改。
 */
@Entity
@Table(name = "exam_progress")
public class ExamProgress {

    @Id
    private Long examId;

    @Column(nullable = false, columnDefinition = "text")
    private String answers;

    @Column(nullable = false)
    private int elapsedSeconds;

    private Long recordedAttemptId;

    @Column(nullable = false)
    private Instant updatedAt;

    protected ExamProgress() {
    }

    public ExamProgress(Long examId, String answers, int elapsedSeconds, Long recordedAttemptId,
                        Instant updatedAt) {
        this.examId = examId;
        update(answers, elapsedSeconds, recordedAttemptId, updatedAt);
    }

    public void update(String answers, int elapsedSeconds, Long recordedAttemptId, Instant updatedAt) {
        this.answers = answers;
        this.elapsedSeconds = elapsedSeconds;
        this.recordedAttemptId = recordedAttemptId;
        this.updatedAt = updatedAt;
    }

    public Long getExamId() {
        return examId;
    }

    public String getAnswers() {
        return answers;
    }

    public int getElapsedSeconds() {
        return elapsedSeconds;
    }

    public Long getRecordedAttemptId() {
        return recordedAttemptId;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
