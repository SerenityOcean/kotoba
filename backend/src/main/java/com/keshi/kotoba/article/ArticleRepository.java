package com.keshi.kotoba.article;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ArticleRepository extends JpaRepository<Article, Long> {

    List<Article> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Article> findByIdAndOwnerId(Long id, Long ownerId);
}
