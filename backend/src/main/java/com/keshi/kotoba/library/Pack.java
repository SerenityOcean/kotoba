package com.keshi.kotoba.library;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 一个资料包：封面上的那些字，加上解锁时复制给用户的卡片和文章（{@link PackContent}，整份一个 JSON）。
 * 随笔不在这里，挂在 {@link LibraryEssay} 上 —— 随笔不复制，读的是同一份。
 */
@Entity
@Table(name = "pack")
public class Pack {

    public enum Status {
        /** 只有主人看得见 */
        DRAFT,
        /** 书架上有，但还不能买 */
        SOON,
        ON_SALE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String slug;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String level;

    @Column(nullable = false, columnDefinition = "text")
    private String glyph;

    @Column(nullable = false, columnDefinition = "text")
    private String tint;

    @Column(nullable = false, columnDefinition = "text")
    private String summary;

    @Column(nullable = false, columnDefinition = "text")
    private String intro;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private Status status;

    private Integer priceCents;

    @Column(columnDefinition = "text")
    private String note;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private int cardCount;

    @Column(nullable = false)
    private int articleCount;

    @Column(nullable = false)
    private int sort;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Pack() {
    }

    public Pack(String slug, Instant now) {
        this.slug = slug;
        this.createdAt = now;
    }

    /** 主人整份重写。内容的 JSON 和计数由调用方一起给，免得两边对不上。 */
    void rewrite(PackUpsertRequest request, String content, int cardCount, int articleCount, Instant now) {
        this.title = request.title().strip();
        this.level = request.level().strip();
        this.glyph = request.glyph().strip();
        this.tint = request.tint();
        this.summary = request.summary().strip();
        this.intro = request.intro().strip();
        this.status = request.status();
        this.priceCents = request.priceCents();
        this.note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        this.sort = request.sort() == null ? 0 : request.sort();
        this.content = content;
        this.cardCount = cardCount;
        this.articleCount = articleCount;
        this.updatedAt = now;
    }

    /** 能下单：在卖、标了价。 */
    public boolean onSale() {
        return status == Status.ON_SALE && priceCents != null;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getLevel() {
        return level;
    }

    public String getGlyph() {
        return glyph;
    }

    public String getTint() {
        return tint;
    }

    public String getSummary() {
        return summary;
    }

    public String getIntro() {
        return intro;
    }

    public Status getStatus() {
        return status;
    }

    public Integer getPriceCents() {
        return priceCents;
    }

    public String getNote() {
        return note;
    }

    public String getContent() {
        return content;
    }

    public int getCardCount() {
        return cardCount;
    }

    public int getArticleCount() {
        return articleCount;
    }

    public int getSort() {
        return sort;
    }
}
