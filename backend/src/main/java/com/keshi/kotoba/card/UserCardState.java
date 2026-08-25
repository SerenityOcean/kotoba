package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Duration;
import java.time.Instant;

/**
 * 一个用户在一张卡片上的学习进度。
 * 学习状态挂在 (user, card) 上，因为同一个词不同人的进度不同。
 */
@Entity
@Table(
        name = "user_card_state",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_state_user_card", columnNames = {"user_id", "card_id"}),
        indexes = @Index(
                name = "idx_state_user_due", columnList = "user_id, due_at")
)
public class UserCardState {

    private static final double MIN_EASE_FACTOR = 1.3;
    private static final double INITIAL_EASE_FACTOR = 2.5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long cardId;

    @Column(nullable = false)
    private Instant dueAt;

    @Column(nullable = false)
    private int intervalDays;

    @Column(nullable = false)
    private int repetitions;

    @Column(nullable = false)
    private double easeFactor;

    @Column(nullable = false)
    private int lapses;

    protected UserCardState() {
    }

    /** 新卡片：立刻到期，等待第一次复习。 */
    public UserCardState(Long userId, Long cardId, Instant now) {
        this.userId = userId;
        this.cardId = cardId;
        this.dueAt = now;
        this.intervalDays = 0;
        this.repetitions = 0;
        this.easeFactor = INITIAL_EASE_FACTOR;
        this.lapses = 0;
    }

    /**
     * 简化 SM-2。返回本次算出的新间隔（天）。
     */
    public int applyReview(Rating rating, Instant now) {
        if (rating == Rating.AGAIN) {
            repetitions = 0;
            intervalDays = 0;
            easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.20);
            lapses++;
            dueAt = now;
            return intervalDays;
        }

        if (rating == Rating.HARD) {
            easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
        }

        // ⚠️ 必须先用旧的 repetitions 算间隔，再自增。反了的话新卡第一次就跳到 6 天。
        int newInterval;
        if (repetitions == 0) {
            newInterval = 1;
        } else if (repetitions == 1) {
            newInterval = 6;
        } else {
            double factor = (rating == Rating.HARD) ? 1.2 : easeFactor;
            newInterval = (int) Math.round(intervalDays * factor);
        }

        repetitions++;
        intervalDays = newInterval;
        dueAt = now.plus(Duration.ofDays(newInterval));
        return newInterval;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getCardId() {
        return cardId;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public int getIntervalDays() {
        return intervalDays;
    }

    public int getRepetitions() {
        return repetitions;
    }

    public double getEaseFactor() {
        return easeFactor;
    }

    public int getLapses() {
        return lapses;
    }
}