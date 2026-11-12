package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ExamHighlightRepository extends JpaRepository<ExamHighlight, Long> {

    List<ExamHighlight> findByExamId(Long examId);

    List<ExamHighlight> findByExamIdAndAnchorIn(Long examId, Collection<String> anchors);

    long countByExamId(Long examId);
}
