package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserCardStateRepository extends JpaRepository<UserCardState, Long> {

    Optional<UserCardState> findByUserIdAndCardId(Long userId, Long cardId);

    List<UserCardState> findByUserId(Long userId);

    List<UserCardState> findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(Long userId, Instant time);

    long countByUserIdAndDueAtLessThanEqual(Long userId, Instant time);

    void deleteByCardId(Long cardId);
}