package com.keshi.kotoba.article;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class ArticleService {

    private final ArticleRepository articleRepository;

    public ArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    @Transactional(readOnly = true)
    public List<Article> findAll(Long userId) {
        return articleRepository.findByOwnerIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public Article find(Long userId, Long id) {
        return articleRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new ArticleNotFoundException(id));
    }

    @Transactional
    public Article create(Long userId, String title, String body, String sourceUrl) {
        return articleRepository.save(
                new Article(userId, title, body, sourceUrl, Instant.now()));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        articleRepository.delete(find(userId, id));
    }
}
