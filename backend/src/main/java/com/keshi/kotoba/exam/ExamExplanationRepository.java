package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamExplanationRepository extends JpaRepository<ExamExplanation, Long> {

    List<ExamExplanation> findByExamId(Long examId);

    Optional<ExamExplanation> findByExamIdAndQuestionNumber(Long examId, int questionNumber);
}
