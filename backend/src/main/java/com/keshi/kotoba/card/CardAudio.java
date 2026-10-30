package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * 卡片自带的一段录音，导入 Anki 牌组时从包里取出来传上来的。
 * 卡片上另有两个标记记着有没有（{@link Card#hasWordAudio()}），平时不用碰这张表。
 */
@Entity
@Table(
        name = "card_audio",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_card_audio_card_kind", columnNames = {"card_id", "kind"})
)
public class CardAudio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long cardId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AudioKind kind;

    @Column(nullable = false, length = 64)
    private String contentType;

    /** 单独记一份大小：算每人用了多少空间时不用把录音读出来。 */
    @Column(nullable = false)
    private int sizeBytes;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(nullable = false)
    private Instant createdAt;

    protected CardAudio() {
    }

    public CardAudio(Long cardId, AudioKind kind, String contentType, byte[] data, Instant now) {
        this.cardId = cardId;
        this.kind = kind;
        this.contentType = contentType;
        this.sizeBytes = data.length;
        this.data = data;
        this.createdAt = now;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
