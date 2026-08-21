package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface CardRepository extends JpaRepository<Card, Long> {

    List<Card> findAllByOrderByCreatedAtDesc();

    List<Card> findByDueAtLessThanEqualOrderByDueAtAsc(Instant now);

    long countByDueAtLessThanEqual(Instant now);

    @Query("select c.front from Card c where c.front in :fronts")
    Set<String> findExistingFronts(@Param("fronts") Collection<String> fronts);
}