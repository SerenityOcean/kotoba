package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface CardRepository extends JpaRepository<Card, Long> {

    List<Card> findAllByOrderByCreatedAtDesc();

    List<Card> findByDueAtLessThanEqualOrderByDueAtAsc(Instant now);

    long countByDueAtLessThanEqual(Instant now);
}