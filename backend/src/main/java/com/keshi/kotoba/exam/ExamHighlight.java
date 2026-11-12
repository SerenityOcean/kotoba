package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 卷面上一段文字里涂的重点。一段最多一行，ranges 是 {@link HighlightRange} 列表的 JSON。
 * 卷子本身就分了人，这里不再存 owner。
 */
@Entity
@Table(name = "exam_highlight")
public class ExamHighlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long examId;

    @Column(nullable = false, length = 40)
    private String anchor;

    @Column(nullable = false, columnDefinition = "text")
    private String ranges;

    @Column(nullable = false)
    private Instant updatedAt;

    protected ExamHighlight() {
    }

    public ExamHighlight(Long examId, String anchor, String ranges, Instant updatedAt) {
        this.examId = examId;
        this.anchor = anchor;
        this.ranges = ranges;
        this.updatedAt = updatedAt;
    }

    public String getAnchor() {
        return anchor;
    }

    public String getRanges() {
        return ranges;
    }

    public void replace(String ranges, Instant updatedAt) {
        this.ranges = ranges;
        this.updatedAt = updatedAt;
    }
}
