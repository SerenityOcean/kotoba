package com.keshi.kotoba.activity;

import java.time.LocalDate;

/**
 * 某一天做了什么。日期是用户所在时区的日历日。
 *
 * @param reviews  复习了几次（同一张卡一天刷两遍算两次）
 * @param learned  其中有几张是头一回复习 —— 也就是「新学」
 * @param articles 读了几篇文章（按存进来的时间算）
 */
public record DailyActivity(
        LocalDate date,
        int reviews,
        int learned,
        int articles
) {
}
