package com.keshi.kotoba.article;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 读过的文章。正文里的注音用 Anki 那套方括号记法 —— 和卡片、拆解结果
 * 同一套，前端同一个 Furigana 组件渲染。
 *
 * <p>存的时候正文已经注好音了：注音在前端按段落并行调模型做完再提交，
 * 这边只负责存，不碰模型。
 */
@Entity
@Table(name = "article")
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(columnDefinition = "text")
    private String sourceUrl;

    @Column(nullable = false)
    private Instant createdAt;

    protected Article() {
    }

    public Article(Long ownerId, String title, String body, String sourceUrl, Instant createdAt) {
        this.ownerId = ownerId;
        this.title = title.trim();
        this.body = body;
        this.sourceUrl = sourceUrl == null || sourceUrl.isBlank() ? null : sourceUrl.trim();
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
