package com.keshi.kotoba.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Long> {

    /** 一份卷子的历次交卷，最近的在前。 */
    List<ExamAttempt> findByExamIdAndOwnerIdOrderBySubmittedAtDesc(Long examId, Long ownerId);

    /** 这个人所有的交卷，列表页按卷子归拢出「做过几次、上次几分」。 */
    List<ExamAttempt> findByOwnerIdOrderBySubmittedAtDesc(Long ownerId);
}
