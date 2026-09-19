package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    void deleteByCardId(Long cardId);

    void deleteByCardIdIn(Collection<Long> cardIds);

    long countByUserIdAndReviewedAtGreaterThanEqual(Long userId, Instant time);
}
