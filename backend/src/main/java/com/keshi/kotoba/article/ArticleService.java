package com.keshi.kotoba.article;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;

@Service
public class ArticleService {

    /** 一页最多这么多篇，前端默认要得更少。 */
    static final int MAX_PAGE_SIZE = 100;

    /**
     * 字数按剥掉注音之后算，和列表里每篇的字数对得上。正则和
     * {@link com.keshi.kotoba.text.FuriganaNotation} 是同一条，两边改要一起改。
     */
    private static final String STATS_SQL = """
            SELECT count(*) AS count,
                   coalesce(sum(char_length(
                       regexp_replace(body, '([\\u4e00-\\u9fff々〆ヶ]+)\\[[^][]+\\]', '\\1', 'g'))), 0) AS chars,
                   max(created_at) AS latest
            FROM article
            WHERE owner_id = :userId
            """;

    private final ArticleRepository articleRepository;
    private final NamedParameterJdbcTemplate jdbc;

    public ArticleService(ArticleRepository articleRepository, NamedParameterJdbcTemplate jdbc) {
        this.articleRepository = articleRepository;
        this.jdbc = jdbc;
    }

    /** 第 page 页（从 0 数），只看标题里含 keyword 的。 */
    @Transactional(readOnly = true)
    public Page<Article> page(Long userId, String keyword, int page, int size) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
        return articleRepository.findByOwnerIdAndTitleContainingIgnoreCaseOrderByCreatedAtDesc(
                userId, keyword == null ? "" : keyword.trim(), request);
    }

    @Transactional(readOnly = true)
    public ArticleStats stats(Long userId) {
        return jdbc.queryForObject(STATS_SQL, new MapSqlParameterSource("userId", userId),
                (rs, row) -> {
                    OffsetDateTime latest = rs.getObject("latest", OffsetDateTime.class);
                    return new ArticleStats(
                            rs.getLong("count"),
                            rs.getLong("chars"),
                            latest == null ? null : latest.toInstant());
                });
    }

    @Transactional(readOnly = true)
    public Article find(Long userId, Long id) {
        return articleRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new ArticleNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public ArticleNeighbors neighbors(Long userId, Long id) {
        Instant createdAt = find(userId, id).getCreatedAt();
        return new ArticleNeighbors(
                articleRepository
                        .findFirstByOwnerIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(userId, createdAt)
                        .orElse(null),
                articleRepository
                        .findFirstByOwnerIdAndCreatedAtLessThanOrderByCreatedAtDesc(userId, createdAt)
                        .orElse(null));
    }

    @Transactional
    public Article create(Long userId, String title, String body, String sourceUrl) {
        return articleRepository.save(
                new Article(userId, title, body, sourceUrl, Instant.now()));
    }

    @Transactional
    public Article update(Long userId, Long id, String title, String body, String sourceUrl) {
        Article article = find(userId, id);
        article.revise(title, body, sourceUrl);
        return article;
    }

    @Transactional
    public void delete(Long userId, Long id) {
        articleRepository.delete(find(userId, id));
    }
}
