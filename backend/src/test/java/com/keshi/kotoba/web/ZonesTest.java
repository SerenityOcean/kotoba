package com.keshi.kotoba.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 「今天复习了几张」从哪一刻算起。 */
class ZonesTest {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    @Test
    @DisplayName("上海凌晨的复习算当天：今天从上海零点（UTC 前一天 16 点）算起")
    void countsFromLocalMidnight() {
        // UTC 10/6 23:30 = 上海 10/7 07:30
        Instant now = Instant.parse("2026-10-06T23:30:00Z");

        assertEquals(Instant.parse("2026-10-06T16:00:00Z"), Zones.startOfDay(now, SHANGHAI));
        // 以前的算法：UTC 零点，等于把上海 10/7 00:00～08:00 之间的复习都丢给了前一天
        assertEquals(Instant.parse("2026-10-06T00:00:00Z"), Zones.startOfDay(now, ZoneOffset.UTC));
    }

    @Test
    @DisplayName("时区没带或者不认识，按 UTC，不报错")
    void fallsBackToUtc() {
        assertEquals(ZoneOffset.UTC, Zones.orUtc(null));
        assertEquals(ZoneOffset.UTC, Zones.orUtc(""));
        assertEquals(ZoneOffset.UTC, Zones.orUtc("Mars/Olympus"));
        assertEquals(SHANGHAI, Zones.orUtc("Asia/Shanghai"));
    }
}
