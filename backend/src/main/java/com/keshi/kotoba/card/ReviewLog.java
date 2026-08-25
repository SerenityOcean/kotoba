package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "review_log", indexes = @Index(columnList = "cardId"))
public class ReviewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)          // ← 新增
    private Long userId;               // ← 新增

    @Column(nullable = false)
    private Long cardId;

    @Column(nullable = false)
    private Instant reviewedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Rating rating;

    @Column(nullable = false)
    private int intervalAfterDays;

    protected ReviewLog() {
    }

    // ← 构造函数多了第一个参数 userId
    public ReviewLog(Long userId, Long cardId, Instant reviewedAt, Rating rating, int intervalAfterDays) {
        this.userId = userId;
        this.cardId = cardId;
        this.reviewedAt = reviewedAt;
        this.rating = rating;
        this.intervalAfterDays = intervalAfterDays;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {           // ← 新增
        return userId;
    }

    public Long getCardId() {
        return cardId;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public Rating getRating() {
        return rating;
    }

    public int getIntervalAfterDays() {
        return intervalAfterDays;
    }
}