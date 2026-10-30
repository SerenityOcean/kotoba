package com.keshi.kotoba.library;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LibraryEssayRepository extends JpaRepository<LibraryEssay, Long> {

    Optional<LibraryEssay> findBySlug(String slug);

    /** 谁都能读的那些，新发的在前。 */
    List<LibraryEssay> findByPackIdIsNullAndPublishedAtIsNotNullOrderBySortAscPublishedAtDesc();

    /** 一个包里的，按主人排的顺序。 */
    List<LibraryEssay> findByPackIdAndPublishedAtIsNotNullOrderBySortAscPublishedAtAsc(Long packId);

    /** 书架上每个包有几篇随笔。 */
    List<LibraryEssay> findByPackIdIsNotNullAndPublishedAtIsNotNull();
}
