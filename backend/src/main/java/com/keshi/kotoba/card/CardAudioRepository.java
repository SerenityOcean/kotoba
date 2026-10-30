package com.keshi.kotoba.card;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CardAudioRepository extends JpaRepository<CardAudio, Long> {

    Optional<CardAudio> findByCardIdAndKind(Long cardId, AudioKind kind);

    /** 换录音前先删掉原来那段。不先查出来再删 —— 那样会把整段录音读进内存。 */
    @Modifying(flushAutomatically = true)
    @Query("delete from CardAudio a where a.cardId = :cardId and a.kind = :kind")
    void remove(@Param("cardId") Long cardId, @Param("kind") AudioKind kind);

    /** 这个人的录音一共占了多少字节。 */
    @Query("select coalesce(sum(a.sizeBytes), 0) from CardAudio a "
            + "where a.cardId in (select c.id from Card c where c.ownerId = :ownerId)")
    long totalBytes(@Param("ownerId") Long ownerId);
}
