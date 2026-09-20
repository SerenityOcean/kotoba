package com.keshi.kotoba.article;

import java.time.Instant;

/**
 * 列表用，不带正文 —— 文章可能上万字，列一页就把整库正文拖出来了。
 * 给个开头和字数，够列表显示。
 */
public record ArticleSummary(
        Long id,
        String title,
        String excerpt,
        int length,
        String sourceUrl,
        Instant createdAt
) {

    private static final int EXCERPT_LENGTH = 60;

    public static ArticleSummary from(Article article) {
        String body = article.getBody();
        return new ArticleSummary(
                article.getId(),
                article.getTitle(),
                body.length() <= EXCERPT_LENGTH ? body : body.substring(0, EXCERPT_LENGTH) + "…",
                body.length(),
                article.getSourceUrl(),
                article.getCreatedAt());
    }
}
