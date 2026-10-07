package com.keshi.kotoba.card;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 每天新卡上限：到期的旧卡全给，新卡按名额放。「今天学了几张」要查复习记录，
 * 所以连真库（要先 docker compose up 起本地库）。
 */
@SpringBootTest
class StudyPlanIntegrationTest {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    @Autowired
    private CardService cardService;

    @Autowired
    private StudyPlan studyPlan;

    @Autowired
    private JdbcTemplate jdbc;

    private long userId;

    @BeforeEach
    void setUp() {
        String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        userId = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, username);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM review_log WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM user_card_state WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM card WHERE owner_id = ?", userId);
        jdbc.update("DELETE FROM deck WHERE owner_id = ?", userId);
        jdbc.update("DELETE FROM app_user WHERE id = ?", userId);
    }

    @Test
    @DisplayName("没设过就是每天 20 张新卡；旧卡排在前面，一张不少")
    void defaultsToTwentyNewAfterReviews() {
        List<Long> fresh = newCards(30);
        List<Long> old = newCards(3);
        // 这 3 张以前学过（答错过，现在又到期了），算旧卡
        old.forEach(id -> jdbc.update("UPDATE user_card_state SET lapses = 1 WHERE card_id = ?", id));

        List<CardService.CardWithState> due = cardService.findDue(userId, null, Instant.now(), SHANGHAI, 0);

        assertEquals(23, due.size());
        assertEquals(old, due.subList(0, 3).stream().map(c -> c.card().getId()).toList(), "旧卡在前");
        assertEquals(fresh.subList(0, 20), due.subList(3, 23).stream().map(c -> c.card().getId()).toList(),
                "新卡按建卡先后放出前 20 张");
    }

    @Test
    @DisplayName("今天已经学了的新卡占名额；「再来几张」在名额之外另给")
    void learnedTodayUsesUpTheAllowance() {
        List<Long> fresh = newCards(30);
        Instant now = Instant.now();
        for (Long id : fresh.subList(0, 5)) {
            cardService.review(userId, id, Rating.GOOD, now);
        }

        assertEquals(5, studyPlan.learnedToday(userId, now, SHANGHAI));
        assertEquals(15, cardService.findDue(userId, null, now, SHANGHAI, 0).size());
        assertEquals(25, cardService.findDue(userId, null, now, SHANGHAI, 10).size());
    }

    @Test
    @DisplayName("上限设成 0 只复习旧卡，设成不限就全放出来")
    void zeroAndUnlimited() {
        newCards(30);

        studyPlan.setDailyNewLimit(userId, 0);
        assertEquals(0, cardService.findDue(userId, null, Instant.now(), SHANGHAI, 0).size());

        studyPlan.setDailyNewLimit(userId, null);
        assertEquals(30, cardService.findDue(userId, null, Instant.now(), SHANGHAI, 0).size());

        assertThrows(IllegalArgumentException.class, () -> studyPlan.setDailyNewLimit(userId, -1));
        assertThrows(IllegalArgumentException.class, () -> studyPlan.setDailyNewLimit(userId, 501));
    }

    @Test
    @DisplayName("首页的数字和复习页对得上：待复习 = 旧卡 + 今天能放的新卡")
    void statsMatchTheQueue() {
        newCards(30);
        studyPlan.setDailyNewLimit(userId, 10);
        Instant now = Instant.now();

        CardService.Stats stats = cardService.stats(userId, now, SHANGHAI);

        assertEquals(10, stats.newToday());
        assertEquals(30, stats.newWaiting());
        assertEquals(10, stats.dueToday());
        assertEquals(10, cardService.findDue(userId, null, now, SHANGHAI, 0).size());
        assertEquals(10, stats.dailyNewLimit());
        long deckDue = cardService.countsByDeck(userId, now, SHANGHAI).values().stream()
                .mapToLong(CardService.DeckCounts::due).sum();
        assertEquals(10, deckDue, "包列表上的「复习 N」也按名额折算");
    }

    private List<Long> newCards(int count) {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ids.add(cardService.create(userId, null, "単語" + ids.hashCode() + "_" + i + "_" + System.nanoTime(), "词").card().getId());
        }
        return ids;
    }
}
