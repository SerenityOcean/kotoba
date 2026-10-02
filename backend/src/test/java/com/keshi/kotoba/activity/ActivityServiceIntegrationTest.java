package com.keshi.kotoba.activity;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 按天分组是 Postgres 的 AT TIME ZONE 在做，mock 不出来，所以连真库
 * （和 AuthFlowIntegrationTest 一样，要先 docker compose up 起本地库）。
 * review_log 的 card_id 没有外键，这里随手编卡片 id，不用真建卡。
 */
@SpringBootTest
class ActivityServiceIntegrationTest {

    private static final String SHANGHAI = "Asia/Shanghai";
    private static final LocalDate SEP_22 = LocalDate.parse("2026-09-22");
    private static final LocalDate SEP_23 = LocalDate.parse("2026-09-23");

    @Autowired
    private ActivityService activityService;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<Long> createdUsers = new ArrayList<>();
    private long userId;

    @BeforeEach
    void setUp() {
        userId = createUser();
    }

    @AfterEach
    void cleanUp() {
        for (long id : createdUsers) {
            jdbc.update("DELETE FROM review_log WHERE user_id = ?", id);
            jdbc.update("DELETE FROM article WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM app_user WHERE id = ?", id);
        }
    }

    @Test
    @DisplayName("东八区的深夜算当天，UTC 的深夜算到东八区的第二天")
    void groupsByLocalDay() {
        review(1, "2026-09-22T15:30:00Z");  // 上海 23:30，9/22
        review(2, "2026-09-22T16:30:00Z");  // 上海 00:30，已经是 9/23

        assertEquals(List.of(
                        new DailyActivity(SEP_22, 1, 1, 0),
                        new DailyActivity(SEP_23, 1, 1, 0)),
                activityService.daily(userId, SEP_22, SEP_23, SHANGHAI));

        // 同样两条，按 UTC 算都落在 9/22
        assertEquals(List.of(new DailyActivity(SEP_22, 2, 2, 0)),
                activityService.daily(userId, SEP_22, SEP_23, "UTC"));
    }

    @Test
    @DisplayName("同一张卡只有头一回复习算新学，哪怕头一回在查询范围之前")
    void countsLearnedOnlyOnFirstReview() {
        review(1, "2026-09-10T02:00:00Z");  // 范围之前就学过
        review(1, "2026-09-22T02:00:00Z");
        review(2, "2026-09-22T03:00:00Z");  // 新卡
        review(2, "2026-09-22T04:00:00Z");  // 当天又刷一遍

        assertEquals(List.of(new DailyActivity(SEP_22, 3, 1, 0)),
                activityService.daily(userId, SEP_22, SEP_22, SHANGHAI));
    }

    @Test
    @DisplayName("只存了文章、没复习的日子也要有")
    void includesArticleOnlyDays() {
        review(1, "2026-09-22T02:00:00Z");
        article("2026-09-22T05:00:00Z");
        article("2026-09-23T05:00:00Z");
        article("2026-09-23T06:00:00Z");

        assertEquals(List.of(
                        new DailyActivity(SEP_22, 1, 1, 1),
                        new DailyActivity(SEP_23, 0, 0, 2)),
                activityService.daily(userId, SEP_22, SEP_23, SHANGHAI));
    }

    @Test
    @DisplayName("范围两头都含，范围外的不算")
    void respectsRangeBoundaries() {
        review(1, "2026-09-21T15:59:59Z");  // 上海 9/21 23:59:59，范围外
        review(2, "2026-09-21T16:00:00Z");  // 上海 9/22 00:00，范围内
        review(3, "2026-09-23T15:59:59Z");  // 上海 9/23 23:59:59，范围内
        review(4, "2026-09-23T16:00:00Z");  // 上海 9/24，范围外

        List<DailyActivity> days = activityService.daily(userId, SEP_22, SEP_23, SHANGHAI);

        assertEquals(2, days.stream().mapToInt(DailyActivity::reviews).sum());
    }

    @Test
    @DisplayName("别人的记录不算进来")
    void ignoresOtherUsers() {
        long other = createUser();
        review(other, 1, "2026-09-22T02:00:00Z");
        review(1, "2026-09-22T02:00:00Z");

        assertEquals(List.of(new DailyActivity(SEP_22, 1, 1, 0)),
                activityService.daily(userId, SEP_22, SEP_22, SHANGHAI));
    }

    @Test
    @DisplayName("偏移量写法的时区不收 —— Postgres 会把符号读反")
    void rejectsOffsetTimeZones() {
        assertThrows(IllegalArgumentException.class,
                () -> activityService.daily(userId, SEP_22, SEP_23, "+08:00"));
        assertThrows(IllegalArgumentException.class,
                () -> activityService.daily(userId, SEP_22, SEP_23, "GMT+8"));
        assertThrows(IllegalArgumentException.class,
                () -> activityService.daily(userId, SEP_22, SEP_23, null));
    }

    @Test
    @DisplayName("结束早于开始、范围太长都不收")
    void rejectsBadRanges() {
        assertThrows(IllegalArgumentException.class,
                () -> activityService.daily(userId, SEP_23, SEP_22, SHANGHAI));
        assertThrows(IllegalArgumentException.class,
                () -> activityService.daily(userId, SEP_22,
                        SEP_22.plusYears(ActivityService.MAX_YEARS).plusDays(1), SHANGHAI));
    }

    private long createUser() {
        String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        long id = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, username);
        createdUsers.add(id);
        return id;
    }

    private void review(long cardId, String at) {
        review(userId, cardId, at);
    }

    private void review(long user, long cardId, String at) {
        jdbc.update("""
                INSERT INTO review_log (user_id, card_id, reviewed_at, rating, interval_after_days)
                VALUES (?, ?, ?, 'GOOD', 1)
                """, user, cardId, ts(at));
    }

    private void article(String at) {
        jdbc.update("INSERT INTO article (owner_id, title, body, created_at) VALUES (?, 't', 'b', ?)",
                userId, ts(at));
    }

    private static Timestamp ts(String instant) {
        return Timestamp.from(Instant.parse(instant));
    }
}
