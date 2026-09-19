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

    List<Card> findByDeckIdOrderByCreatedAtDesc(Long deckId);

    /** 带 ownerId 的查询 = 归属校验。查不到就是 404，不区分"不存在"和"不是你的"。 */
    Optional<Card> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerId(Long ownerId);

    /** 重名判断的范围是包，不是用户 —— 同一个词可以在不同包里各存一张。 */
    @Query("select c.front from Card c where c.deckId = :deckId and c.front in :fronts")
    Set<String> findExistingFronts(@Param("deckId") Long deckId,
                                   @Param("fronts") Collection<String> fronts);

    @Query("select c.deckId as deckId, count(c) as count from Card c "
            + "where c.ownerId = :ownerId group by c.deckId")
    List<DeckCount> countByDeck(@Param("ownerId") Long ownerId);

    @Query("select c.id from Card c where c.deckId = :deckId")
    List<Long> findIdsByDeckId(@Param("deckId") Long deckId);

    void deleteByDeckId(Long deckId);
}
