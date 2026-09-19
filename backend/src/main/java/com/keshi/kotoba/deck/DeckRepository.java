package com.keshi.kotoba.deck;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeckRepository extends JpaRepository<Deck, Long> {

    List<Deck> findByOwnerIdOrderByCreatedAtAsc(Long ownerId);

    /** 带 ownerId 的查询 = 归属校验。查不到就是 404。 */
    Optional<Deck> findByIdAndOwnerId(Long id, Long ownerId);

    Optional<Deck> findByOwnerIdAndName(Long ownerId, String name);

    boolean existsByOwnerIdAndName(Long ownerId, String name);
}
