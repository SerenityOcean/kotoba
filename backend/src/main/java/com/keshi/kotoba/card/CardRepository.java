package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface CardRepository extends JpaRepository<Card, Long> {

    List<Card> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    /** 带 ownerId 的查询 = 归属校验。查不到就是 404，不区分"不存在"和"不是你的"。 */
    Optional<Card> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerId(Long ownerId);

    @Query("select c.front from Card c where c.ownerId = :ownerId and c.front in :fronts")
    Set<String> findExistingFronts(@Param("ownerId") Long ownerId,
                                   @Param("fronts") Collection<String> fronts);
}