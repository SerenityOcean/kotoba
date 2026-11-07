package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExamProgressRepository extends JpaRepository<ExamProgress, Long> {

    /** 这个人所有卷子的进度，列表页显示做到第几题。 */
    @Query("""
            select p from ExamProgress p
            where p.examId in (select e.id from Exam e where e.ownerId = :ownerId)""")
    List<ExamProgress> findByOwner(@Param("ownerId") Long ownerId);
}
