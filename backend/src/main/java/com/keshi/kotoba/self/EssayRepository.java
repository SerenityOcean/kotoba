package com.keshi.kotoba.self;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** 只有一种读法：从新到旧，一页一页往前翻。 */
public interface EssayRepository extends JpaRepository<Essay, Long> {

    List<Essay> findAllByOrderByIdDesc(Pageable page);

    List<Essay> findByIdLessThanOrderByIdDesc(Long id, Pageable page);
}
