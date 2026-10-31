package com.keshi.kotoba.article;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.Optional;

public interface ArticleRepository extends JpaRepository<Article, Long>, JpaSpecificationExecutor<Article> {

    Optional<Article> findByIdAndOwnerId(Long id, Long ownerId);

    /** 比这篇新的里面最旧的一篇 —— 列表里紧挨在它上面的那篇。 */
    Optional<ArticleLink> findFirstByOwnerIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            Long ownerId, Instant createdAt);

    /** 比这篇旧的里面最新的一篇 —— 列表里紧挨在它下面的那篇。 */
    Optional<ArticleLink> findFirstByOwnerIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long ownerId, Instant createdAt);

    // 上一篇/下一篇只在同一个集里走（未归档的互为一堆），连载一篇接一篇不会跳到别处去

    Optional<ArticleLink> findFirstByOwnerIdAndFolderIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            Long ownerId, Long folderId, Instant createdAt);

    Optional<ArticleLink> findFirstByOwnerIdAndFolderIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long ownerId, Long folderId, Instant createdAt);

    Optional<ArticleLink> findFirstByOwnerIdAndFolderIdIsNullAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            Long ownerId, Instant createdAt);

    Optional<ArticleLink> findFirstByOwnerIdAndFolderIdIsNullAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long ownerId, Instant createdAt);
}
