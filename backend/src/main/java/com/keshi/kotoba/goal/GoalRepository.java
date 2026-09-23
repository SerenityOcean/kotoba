package com.keshi.kotoba.goal;

import org.springframework.data.jpa.repository.JpaRepository;

/** 主键就是 ownerId，findById 本身就是归属校验。 */
public interface GoalRepository extends JpaRepository<Goal, Long> {
}
