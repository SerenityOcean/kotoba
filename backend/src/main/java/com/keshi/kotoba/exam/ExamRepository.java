package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Long> {

    /** 列表只要这几列 —— 一份卷子注完音几十 KB，列一页不该把卷面全拖出来。 */
    List<ExamListing> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Exam> findByIdAndOwnerId(Long id, Long ownerId);
}
