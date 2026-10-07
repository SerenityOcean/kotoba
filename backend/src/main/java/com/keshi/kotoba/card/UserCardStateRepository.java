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

    /** 到期的新卡（从没复习过的）有几张。 */
    @Query("select count(s) from UserCardState s "
            + "where s.userId = :userId and s.dueAt <= :time and s.repetitions = 0 and s.lapses = 0")
    long countDueNew(@Param("userId") Long userId, @Param("time") Instant time);

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

    /** 每个包里到期的新卡有几张 —— 包列表上的「复习 N」要按每天新卡上限折算。 */
    @Query("select c.deckId as deckId, count(s) as count from UserCardState s "
            + "join Card c on c.id = s.cardId "
            + "where s.userId = :userId and s.dueAt <= :time and s.repetitions = 0 and s.lapses = 0 "
            + "group by c.deckId")
    List<DeckCount> countDueNewByDeck(@Param("userId") Long userId, @Param("time") Instant time);
}
