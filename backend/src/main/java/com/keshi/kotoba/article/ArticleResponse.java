package com.keshi.kotoba.article;

import java.time.Instant;

/** 单篇，带正文。 */
public record ArticleResponse(
        Long id,
        String title,
        String body,
        String sourceUrl,
        Instant createdAt
) {

    public static ArticleResponse from(Article article) {
        return new ArticleResponse(
                article.getId(),
                article.getTitle(),
                article.getBody(),
                article.getSourceUrl(),
                article.getCreatedAt());
    }
}
