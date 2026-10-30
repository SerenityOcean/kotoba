package com.keshi.kotoba.library;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PackRepository extends JpaRepository<Pack, Long> {

    Optional<Pack> findBySlug(String slug);

    /** 书架：草稿不上架。 */
    List<Pack> findByStatusInOrderBySortAscIdAsc(Collection<Pack.Status> statuses);
}
