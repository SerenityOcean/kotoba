package com.keshi.kotoba.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 一个人的学习节奏。没有这一行就用默认值，见 {@link StudyPlan}。 */
@Entity
@Table(name = "study_settings")
public class StudySettings {

    @Id
    private Long userId;

    /** 每天放出多少张新卡；null = 不限。 */
    @Column
    private Integer dailyNewLimit;

    protected StudySettings() {
    }

    public StudySettings(Long userId, Integer dailyNewLimit) {
        this.userId = userId;
        this.dailyNewLimit = dailyNewLimit;
    }

    public Integer getDailyNewLimit() {
        return dailyNewLimit;
    }

    public void setDailyNewLimit(Integer dailyNewLimit) {
        this.dailyNewLimit = dailyNewLimit;
    }
}
