package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserCardStateRepository extends JpaRepository<UserCardState, Long> {

    Optional<UserCardState> findByUserIdAndCardId(Long userId, Long cardId);

    List<UserCardState> findByUserId(Long userId);

    List<UserCardState> findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(Long userId, Instant time);

    long countByUserIdAndDueAtLessThanEqual(Long userId, Instant time);

    void deleteByCardId(Long cardId);

    void deleteByCardIdIn(Collection<Long> cardIds);

    /** 某个包里到期的卡片，按到期时间升序 —— 按包复习用。 */
    @Query("select s from UserCardState s join Card c on c.id = s.cardId "
            + "where s.userId = :userId and c.deckId = :deckId and s.dueAt <= :time "
            + "order by s.dueAt asc")
    List<UserCardState> findDueByDeck(@Param("userId") Long userId,
                                      @Param("deckId") Long deckId,
                                      @Param("time") Instant time);

    @Query("select c.deckId as deckId, count(s) as count from UserCardState s "
            + "join Card c on c.id = s.cardId "
            + "where s.userId = :userId and s.dueAt <= :time group by c.deckId")
    List<DeckCount> countDueByDeck(@Param("userId") Long userId, @Param("time") Instant time);
}
