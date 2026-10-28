package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamMarkRepository extends JpaRepository<ExamMark, Long> {

    List<ExamMark> findByExamId(Long examId);

    Optional<ExamMark> findByExamIdAndQuestionNumber(Long examId, int questionNumber);

    void deleteByExamIdAndQuestionNumber(Long examId, int questionNumber);

    /** 这个人每份卷子每档难度标了几题，列表页用。 */
    @Query("""
            select m.examId as examId, m.level as level, count(m) as count
            from ExamMark m
            where m.examId in (select e.id from Exam e where e.ownerId = :ownerId)
            group by m.examId, m.level""")
    List<MarkCount> countByOwner(@Param("ownerId") Long ownerId);

    interface MarkCount {
        Long getExamId();

        Number getLevel();

        Number getCount();
    }
}
