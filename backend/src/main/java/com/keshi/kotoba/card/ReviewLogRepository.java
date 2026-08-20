package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    List<ReviewLog> findByCardIdOrderByReviewedAtDesc(Long cardId);

    long countByReviewedAtGreaterThanEqual(Instant since);

    void deleteByCardId(Long cardId);
}