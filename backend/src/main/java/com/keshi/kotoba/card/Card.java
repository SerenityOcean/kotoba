package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "card")
public class Card {

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