package com.keshi.kotoba.goal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 彼岸：一个人此刻要抵达的目标。每人至多一个 —— 多了就得做列表，首页也放不下。
 *
 * 目标日期存成不带时区的 date：「12 月 6 日考试」在哪个时区都是 12 月 6 日，
 * 还剩几天由前端按本地日期去算。
 */
@Entity
@Table(name = "goal")
public class Goal {

    @Id
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false)
    private LocalDate targetDate;

    @Column(nullable = false)
    private Instant startedAt;

    protected Goal() {
    }

    public Goal(Long ownerId, String title, LocalDate targetDate, Instant startedAt) {
        this.ownerId = ownerId;
        this.title = title;
        this.targetDate = targetDate;
        this.startedAt = startedAt;
    }

    /** 改名、改日期都算同一段路，起点不变。 */
    public void revise(String title, LocalDate targetDate) {
        this.title = title;
        this.targetDate = targetDate;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public LocalDate getTargetDate() {
        return targetDate;
    }

    public Instant getStartedAt() {
        return startedAt;
    }
}
