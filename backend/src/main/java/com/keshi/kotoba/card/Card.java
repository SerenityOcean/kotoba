package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * 卡片内容。学习进度不在这里 —— 见 {@link UserCardState}，
 * 因为同一个词不同用户的进度不同。
 */
@Entity
@Table(
        name = "card",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_card_owner_front", columnNames = {"owner_id", "front"})
)
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String front;

    @Column(columnDefinition = "text")
    private String back;

    @Column(nullable = false)
    private Instant createdAt;

    protected Card() {
    }

    public Card(Long ownerId, String front, String back, Instant now) {
        this.ownerId = ownerId;
        this.front = front;
        this.back = back;
        this.createdAt = now;
    }

    /**
     * 修改卡片内容。不影响复习进度 —— 改错别字不该重置进度。
     */
    public void updateContent(String front, String back) {
        this.front = front.trim();
        this.back = back == null ? null : back.trim();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
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
}