package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "card")
public class Card {

    private static final double MIN_EASE_FACTOR = 1.3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String front;

    @Column(columnDefinition = "text")
    private String back;

    @Column(nullable = false)
    private Instant createdAt;

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

    protected Card() {
    }

    public Card(String front, String back, Instant now) {
        this.front = front;
        this.back = back;
        this.createdAt = now;
        this.dueAt = now;
        this.intervalDays = 0;
        this.repetitions = 0;
        this.easeFactor = 2.5;
        this.lapses = 0;
    }

    /**
     * 修改卡片内容。不影响复习进度。
     */
    public void updateContent(String front, String back) {
        this.front = front.trim();
        this.back = back == null ? null : back.trim();
    }

    /**
     * 应用一次复习结果，更新调度状态。
     *
     * @return 本次计算出的新间隔天数
     */
    public int applyReview(Rating rating, Instant now) {
        if (rating == Rating.AGAIN) {
            this.repetitions = 0;
            this.intervalDays = 0;
            this.easeFactor = Math.max(MIN_EASE_FACTOR, this.easeFactor - 0.20);
            this.lapses += 1;
            this.dueAt = now;
            return 0;
        }

        if (rating == Rating.HARD) {
            this.easeFactor = Math.max(MIN_EASE_FACTOR, this.easeFactor - 0.15);
        }

        int newInterval = nextInterval(rating);

        this.repetitions += 1;
        this.intervalDays = newInterval;
        this.dueAt = now.plus(newInterval, ChronoUnit.DAYS);
        return newInterval;
    }

    private int nextInterval(Rating rating) {
        if (this.repetitions == 0) {
            return 1;
        }
        if (this.repetitions == 1) {
            return 6;
        }
        double multiplier = (rating == Rating.HARD) ? 1.2 : this.easeFactor;
        return (int) Math.round(this.intervalDays * multiplier);
    }

    public Long getId() {
        return id;
    }

    public String getFront() {
        return front;
    }

    public String getBack() {
        return back;
    }

    public Instant getCreatedAt() {
        return createdAt;
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