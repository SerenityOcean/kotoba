package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamMarkRepository extends JpaRepository<ExamMark, Long> {

    List<ExamMark> findByExamId(Long examId);

    Optional<ExamMark> findByExamIdAndQuestionNumber(Long examId, int questionNumber);

    void deleteByExamIdAndQuestionNumber(Long examId, int questionNumber);
}
