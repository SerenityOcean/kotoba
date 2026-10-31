package com.keshi.kotoba.article;

import com.keshi.kotoba.folder.Folder;
import com.keshi.kotoba.folder.FolderService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

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

    /** folder 参数里表示「未归档」的值；真的集 id 从 1 起，不会撞。不传 folder 就是全部。 */
    public static final long UNFILED = 0;

    private final ArticleRepository articleRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final FolderService folderService;

    public ArticleService(ArticleRepository articleRepository, NamedParameterJdbcTemplate jdbc,
                          FolderService folderService) {
        this.articleRepository = articleRepository;
        this.jdbc = jdbc;
        this.folderService = folderService;
    }

    /** 第 page 页（从 0 数），只看标题里含 keyword 的。 */
    @Transactional(readOnly = true)
    public Page<Article> page(Long userId, String keyword, int page, int size) {
        return page(userId, null, keyword, page, size);
    }

    @Transactional(readOnly = true)
    public Page<Article> page(Long userId, Long folder, String keyword, int page, int size) {
        return page(userId, folder, null, keyword, page, size);
    }

    /**
     * 再限定在某个集里（folder 为 null 是全部，{@link #UNFILED} 是未归档），
     * 和已读 / 未读（read 为 null 是都要）。
     */
    @Transactional(readOnly = true)
    public Page<Article> page(Long userId, Long folder, Boolean read, String keyword, int page, int size) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        String q = keyword == null ? "" : keyword.trim();
        Specification<Article> spec = (root, query, cb) -> {
            List<Predicate> all = new ArrayList<>();
            all.add(cb.equal(root.get("ownerId"), userId));
            if (folder != null) {
                all.add(folder == UNFILED ? cb.isNull(root.get("folderId"))
                        : cb.equal(root.get("folderId"), folder));
            }
            if (read != null) {
                all.add(read ? cb.isNotNull(root.get("readAt")) : cb.isNull(root.get("readAt")));
            }
            if (!q.isEmpty()) {
                // 搜索词里的 % _ 当字面字符找，不是通配
                String escaped = q.toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                all.add(cb.like(cb.lower(root.get("title")), "%" + escaped + "%", '\\'));
            }
            return cb.and(all.toArray(Predicate[]::new));
        };
        return articleRepository.findAll(spec, request);
    }

    @Transactional(readOnly = true)
    public ArticleStats stats(Long userId) {
        return stats(userId, null);
    }

    /** 某个集的数；folder 的含义同 {@link #page(Long, Long, String, int, int)}。 */
    @Transactional(readOnly = true)
    public ArticleStats stats(Long userId, Long folder) {
        String where = folder == null ? "" : folder == UNFILED ? " AND folder_id IS NULL"
                : " AND folder_id = :folder";
        MapSqlParameterSource params = new MapSqlParameterSource("userId", userId);
        if (folder != null && folder != UNFILED) {
            params.addValue("folder", folder);
        }
        return jdbc.queryForObject(STATS_SQL + where, params,
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
        Article article = find(userId, id);
        Instant createdAt = article.getCreatedAt();
        Long folderId = article.getFolderId();
        if (folderId == null) {
            return new ArticleNeighbors(
                    articleRepository
                            .findFirstByOwnerIdAndFolderIdIsNullAndCreatedAtGreaterThanOrderByCreatedAtAsc(
                                    userId, createdAt)
                            .orElse(null),
                    articleRepository
                            .findFirstByOwnerIdAndFolderIdIsNullAndCreatedAtLessThanOrderByCreatedAtDesc(
                                    userId, createdAt)
                            .orElse(null));
        }
        return new ArticleNeighbors(
                articleRepository
                        .findFirstByOwnerIdAndFolderIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
                                userId, folderId, createdAt)
                        .orElse(null),
                articleRepository
                        .findFirstByOwnerIdAndFolderIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                                userId, folderId, createdAt)
                        .orElse(null));
    }

    @Transactional
    public Article create(Long userId, String title, String body, String sourceUrl) {
        return create(userId, title, body, sourceUrl, null);
    }

    /** 存进某个集；folderId 为空就是未归档。集必须是这个人的文章集。 */
    @Transactional
    public Article create(Long userId, String title, String body, String sourceUrl, Long folderId) {
        folderService.requireKind(userId, folderId, Folder.Kind.ARTICLE);
        return articleRepository.save(
                new Article(userId, title, body, sourceUrl, Instant.now(), folderId));
    }

    /**
     * 把这些文章挪进某个集；folderId 为空是退回未归档。不是这个人的 id 直接略过，
     * 返回真正挪了几篇。
     */
    @Transactional
    public int moveToFolder(Long userId, List<Long> ids, Long folderId) {
        folderService.requireKind(userId, folderId, Folder.Kind.ARTICLE);
        if (ids.isEmpty()) {
            return 0;
        }
        return jdbc.update("UPDATE article SET folder_id = :folder WHERE owner_id = :userId AND id IN (:ids)",
                new MapSqlParameterSource().addValue("folder", folderId)
                        .addValue("userId", userId).addValue("ids", ids));
    }

    /** 标成已读（第一次读的时间保留）或未读；不是这个人的 id 略过。 */
    @Transactional
    public int markRead(Long userId, List<Long> ids, boolean read) {
        if (ids.isEmpty()) {
            return 0;
        }
        String set = read ? "read_at = coalesce(read_at, now())" : "read_at = NULL";
        return jdbc.update("UPDATE article SET " + set + " WHERE owner_id = :userId AND id IN (:ids)",
                new MapSqlParameterSource().addValue("userId", userId).addValue("ids", ids));
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
