package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    void deleteByCardId(Long cardId);

    // ← 原来的 countByReviewedAtGreaterThanEqual 加上 userId
    long countByUserIdAndReviewedAtGreaterThanEqual(Long userId, Instant time);
}