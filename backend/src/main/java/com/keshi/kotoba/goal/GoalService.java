package com.keshi.kotoba.goal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

@Service
public class GoalService {

    /** 周格子一周一格，十年就是五百多格，再远就不是「目标」了。 */
    static final int MAX_YEARS = 10;

    private final GoalRepository goals;

    public GoalService(GoalRepository goals) {
        this.goals = goals;
    }

    @Transactional(readOnly = true)
    public Optional<Goal> find(Long userId) {
        return goals.findById(userId);
    }

    /** 没有就立一个，有就改。起点只在第一次立的时候记下。 */
    @Transactional
    public Goal save(Long userId, String rawTitle, LocalDate targetDate, Instant now) {
        String title = rawTitle == null ? "" : rawTitle.trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("目标不能为空");
        }

        // 服务器不知道用户在哪个时区，按 UTC 往前宽限一天：
        // 东八区的「今天」在 UTC 里可能还是昨天
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        if (targetDate.isBefore(today.minusDays(1))) {
            throw new IllegalArgumentException("目标日期已经过去了");
        }
        if (targetDate.isAfter(today.plusYears(MAX_YEARS))) {
            throw new IllegalArgumentException("目标定得太远了，最多 " + MAX_YEARS + " 年");
        }

        Goal goal = goals.findById(userId)
                .map(existing -> {
                    existing.revise(title, targetDate);
                    return existing;
                })
                .orElseGet(() -> new Goal(userId, title, targetDate, now));
        return goals.save(goal);
    }

    @Transactional
    public void clear(Long userId) {
        goals.deleteById(userId);
    }
}
