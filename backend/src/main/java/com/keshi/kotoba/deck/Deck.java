package com.keshi.kotoba.deck;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/** 一组卡片。导入 Anki 包时按包名建一个，手动加的卡片进「默认包」。 */
@Entity
@Table(
        name = "deck",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_deck_owner_name", columnNames = {"owner_id", "name"})
)
public class Deck {

    /** V3 迁移给每个用户建的那个包，也是没指定包时的落脚点。 */
    public static final String DEFAULT_NAME = "默认包";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(nullable = false)
    private Instant createdAt;

    protected Deck() {
    }

    public Deck(Long ownerId, String name, Instant createdAt) {
        this.ownerId = ownerId;
        this.name = name;
        this.createdAt = createdAt;
    }

    public void rename(String name) {
        this.name = name.trim();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getName() {
        return name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
