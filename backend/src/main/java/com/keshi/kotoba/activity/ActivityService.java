package com.keshi.kotoba.activity;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 按天汇总一个人做过的事，给彼岸的日格子上色。
 *
 * <p>「哪一天」要按用户的时区算：东八区晚上 11 点复习的卡，在 UTC 里已经是第二天了。
 * 所以时区由前端带过来，查询边界和分组都用它。
 */
@Service
public class ActivityService {

    /** 彼岸最远十年，但改日期时起点不动，起点到终点可能更长，留一倍余量。 */
    static final int MAX_YEARS = 20;

    private static final String DAILY_SQL = """
            WITH reviews AS (
                SELECT (r.reviewed_at AT TIME ZONE :tz)::date AS day,
                       count(*) AS reviews,
                       count(*) FILTER (WHERE NOT EXISTS (
                           SELECT 1 FROM review_log earlier
                           WHERE earlier.user_id = r.user_id
                             AND earlier.card_id = r.card_id
                             AND earlier.reviewed_at < r.reviewed_at)) AS learned
                FROM review_log r
                WHERE r.user_id = :userId AND r.reviewed_at >= :start AND r.reviewed_at < :end
                GROUP BY 1
            ),
            articles AS (
                SELECT (created_at AT TIME ZONE :tz)::date AS day, count(*) AS articles
                FROM article
                WHERE owner_id = :userId AND created_at >= :start AND created_at < :end
                GROUP BY 1
            )
            SELECT coalesce(r.day, a.day) AS day,
                   coalesce(r.reviews, 0) AS reviews,
                   coalesce(r.learned, 0) AS learned,
                   coalesce(a.articles, 0) AS articles
            FROM reviews r
            FULL JOIN articles a ON a.day = r.day
            ORDER BY day
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public ActivityService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** from、to 都含。什么都没做的日子不返回，前端当 0 补上。 */
    @Transactional(readOnly = true)
    public List<DailyActivity> daily(Long userId, LocalDate from, LocalDate to, String timeZone) {
        ZoneId zone = parseZone(timeZone);
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("结束日期早于开始日期");
        }
        if (to.isAfter(from.plusYears(MAX_YEARS))) {
            throw new IllegalArgumentException("一次最多查 " + MAX_YEARS + " 年");
        }

        var params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("tz", zone.getId())
                // 驱动不认 Instant，给它带偏移量的时间
                .addValue("start", from.atStartOfDay(zone).toOffsetDateTime())
                .addValue("end", to.plusDays(1).atStartOfDay(zone).toOffsetDateTime());

        return jdbc.query(DAILY_SQL, params, (rs, row) -> new DailyActivity(
                rs.getObject("day", LocalDate.class),
                rs.getInt("reviews"),
                rs.getInt("learned"),
                rs.getInt("articles")));
    }

    /**
     * 只认 Asia/Shanghai 这样的地区名。「+08:00」「GMT+8」Java 也认，
     * 但 Postgres 的 AT TIME ZONE 按 POSIX 规矩把符号反过来读，分组会错开 16 小时。
     */
    static ZoneId parseZone(String timeZone) {
        if (timeZone == null || !ZoneId.getAvailableZoneIds().contains(timeZone)) {
            throw new IllegalArgumentException("不认识的时区：" + timeZone);
        }
        return ZoneId.of(timeZone);
    }
}
