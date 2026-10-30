package com.keshi.kotoba.library;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 资料里的一篇随笔。packId 为空的谁都能读；挂在包上的，解锁了才能读。
 *
 * <p>正文是一套很小的标记（见前端 library/essay-markup.ts）：空行分段，「## 」起小标题，
 * 「> 」是引文，「::: 例」到「:::」是一块例句，「[^1]」是旁注。日语用方括号注音，
 * 不自动注 —— 正文是中文，词典会把汉字当日语念。
 */
@Entity
@Table(name = "library_essay")
public class LibraryEssay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String slug;

    private Long packId;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    private Instant publishedAt;

    @Column(nullable = false)
    private int sort;

    @Column(nullable = false)
    private Instant updatedAt;

    protected LibraryEssay() {
    }

    public LibraryEssay(String slug) {
        this.slug = slug;
    }

    void rewrite(Long packId, String title, String body, Instant publishedAt, int sort, Instant now) {
        this.packId = packId;
        this.title = title;
        this.body = body;
        this.publishedAt = publishedAt;
        this.sort = sort;
        this.updatedAt = now;
    }

    public boolean free() {
        return packId == null;
    }

    public boolean published() {
        return publishedAt != null;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public Long getPackId() {
        return packId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public int getSort() {
        return sort;
    }
}
