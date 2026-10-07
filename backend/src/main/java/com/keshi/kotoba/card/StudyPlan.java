package com.keshi.kotoba.card;

import com.keshi.kotoba.web.Zones;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

/**
 * 每天放出多少张新卡。
 *
 * <p>「新卡」= 从没复习过的卡（{@link UserCardState#isNew()}）。今天第一次复习它，
 * 就算今天学了一张 —— 和彼岸日格子里「新学」的口径一样，天按用户的时区切。
 *
 * <p>旧卡不限量：该复习的拖着只会越积越多。限的只是新卡往里放的速度，
 * 不然导入一个 200 张的包，当天就是 200 张。
 */
@Service
public class StudyPlan {

    /** 没设过就是这么多 —— Anki 的默认值也是 20。 */
    static final int DEFAULT_DAILY_NEW = 20;
    static final int MAX_DAILY_NEW = 500;

    /** 今天第一次复习的卡有几张：这张卡最早的一条复习记录落在今天。 */
    private static final String LEARNED_SINCE_SQL = """
            SELECT count(*) FROM (
                SELECT card_id FROM review_log
                WHERE user_id = :userId
                GROUP BY card_id
                HAVING min(reviewed_at) >= :start
            ) first_seen_today
            """;

    private final StudySettingsRepository settings;
    private final NamedParameterJdbcTemplate jdbc;

    public StudyPlan(StudySettingsRepository settings, NamedParameterJdbcTemplate jdbc) {
        this.settings = settings;
        this.jdbc = jdbc;
    }

    /** 每天新卡上限；null = 不限。 */
    @Transactional(readOnly = true)
    public Integer dailyNewLimit(Long userId) {
        // 不能写成 findById().map(getDailyNewLimit).orElse(20)：设成「不限」存的是 null，
        // map 碰到 null 会当成「没设过」，又变回 20
        Optional<StudySettings> row = settings.findById(userId);
        return row.isPresent() ? row.get().getDailyNewLimit() : Integer.valueOf(DEFAULT_DAILY_NEW);
    }

    /** @param limit null = 不限，否则 0～500 */
    @Transactional
    public Integer setDailyNewLimit(Long userId, Integer limit) {
        if (limit != null && (limit < 0 || limit > MAX_DAILY_NEW)) {
            throw new IllegalArgumentException("每天新词数要在 0～" + MAX_DAILY_NEW + " 之间");
        }
        StudySettings row = settings.findById(userId).orElseGet(() -> new StudySettings(userId, limit));
        row.setDailyNewLimit(limit);
        settings.save(row);
        return limit;
    }

    @Transactional(readOnly = true)
    public long learnedToday(Long userId, Instant now, ZoneId zone) {
        var params = new MapSqlParameterSource()
                .addValue("userId", userId)
                // 驱动不认 Instant，给它带偏移量的时间
                .addValue("start", Zones.startOfDay(now, zone).atOffset(ZoneOffset.UTC));
        Long count = jdbc.queryForObject(LEARNED_SINCE_SQL, params, Long.class);
        return count == null ? 0 : count;
    }

    /**
     * 今天还能放出几张新卡。extra 是「再来几张」额外要的。不限时返回 Long.MAX_VALUE。
     */
    @Transactional(readOnly = true)
    public long newAllowance(Long userId, Instant now, ZoneId zone, int extra) {
        Integer limit = dailyNewLimit(userId);
        if (limit == null) {
            return Long.MAX_VALUE;
        }
        return Math.max(0, limit - learnedToday(userId, now, zone)) + Math.max(0, extra);
    }
}
