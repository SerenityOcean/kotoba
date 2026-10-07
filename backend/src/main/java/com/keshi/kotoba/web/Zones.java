package com.keshi.kotoba.web;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** 前端带来的时区（浏览器的 Asia/Shanghai 这种）。「今天」都从那里的零点算。 */
public final class Zones {

    private Zones() {
    }

    /**
     * 没带或者不认识（比如还开着旧页面）就按 UTC，不报错 —— 首页、复习页不该因为它打不开。
     */
    public static ZoneId orUtc(String tz) {
        if (tz == null || tz.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(tz);
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    /**
     * zone 那里今天零点是哪个时刻。不能用 {@code now.truncatedTo(DAYS)}：
     * 那是 UTC 的零点，北京时间早上 8 点才算「新的一天」，凌晨复习的全记到前一天。
     */
    public static Instant startOfDay(Instant now, ZoneId zone) {
        return now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant();
    }
}
