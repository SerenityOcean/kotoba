package com.keshi.kotoba.article;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface ArticleRepository extends JpaRepository<Article, Long> {

    /** 列表：按保存时间倒序翻页，标题里含 keyword 的（空串就是全部）。 */
    Page<Article> findByOwnerIdAndTitleContainingIgnoreCaseOrderByCreatedAtDesc(
            Long ownerId, String keyword, Pageable page);

    Optional<Article> findByIdAndOwnerId(Long id, Long ownerId);

    /** 比这篇新的里面最旧的一篇 —— 列表里紧挨在它上面的那篇。 */
    Optional<ArticleLink> findFirstByOwnerIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            Long ownerId, Instant createdAt);

    /** 比这篇旧的里面最新的一篇 —— 列表里紧挨在它下面的那篇。 */
    Optional<ArticleLink> findFirstByOwnerIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long ownerId, Instant createdAt);
}
