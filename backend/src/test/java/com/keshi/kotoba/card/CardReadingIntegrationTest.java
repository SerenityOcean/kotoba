package com.keshi.kotoba.card;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 补读音要走真的仓库查询（按 id 翻页、reading 为空）
 * （要先 docker compose up 起本地库）。
 */
@SpringBootTest
class CardReadingIntegrationTest {

    @Autowired
    private CardService cardService;

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
        jdbc.update("DELETE FROM user_card_state WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM card WHERE owner_id = ?", userId);
        jdbc.update("DELETE FROM deck WHERE owner_id = ?", userId);
        jdbc.update("DELETE FROM app_user WHERE id = ?", userId);
    }

    @Test
    @DisplayName("建卡时就把读音填好：卡片自己带的优先，没有就查词典")
    void guessesOnCreate() {
        assertEquals("たべる", cardService.create(userId, null, "食[た]べる", "吃").card().getReading());
        assertEquals("はんだん", cardService.create(userId, null, "判断", "はんだん 名詞").card().getReading());
        assertEquals("もどす", cardService.create(userId, null, "戻す", "还原").card().getReading());
    }

    @Test
    @DisplayName("补读音：句子和全假名的跳过，其余都补上")
    void fillsReadings() {
        insertWithoutReading("判断", "はんだん 名詞");
        insertWithoutReading("戻す", "还原");
        insertWithoutReading("一緒", "一起");
        insertWithoutReading("それでいて", "尽管如此");

        CardService.ReadingFill fill = cardService.fillReadings(userId, null, 50);

        assertEquals(3, fill.filled());
        assertEquals(0, fill.missed());
        assertNull(fill.nextAfterId(), "一批就翻完了");
        assertEquals(Map.of("判断", "はんだん", "戻す", "もどす", "一緒", "いっしょ"), readings());
    }

    @Test
    @DisplayName("按批往后翻，一批满了给出下一批的起点")
    void pagesThroughBatches() {
        insertWithoutReading("判断", "はんだん");
        insertWithoutReading("理由", "りゆう");
        insertWithoutReading("収入", "しゅうにゅう");

        CardService.ReadingFill first = cardService.fillReadings(userId, null, 2);
        assertNotNull(first.nextAfterId());
        CardService.ReadingFill second = cardService.fillReadings(userId, first.nextAfterId(), 2);
        assertNull(second.nextAfterId());

        assertEquals(3, first.filled() + second.filled());
    }

    @Test
    @DisplayName("只给指定的卡补读音：别人的、已经有读音的不动，补上的连读音一起返回")
    void fillsOnlyTheGivenCards() {
        long dueA = insertWithoutReading("恵まれる", "めぐまれる 自動詞 受到恩惠");
        long dueB = insertWithoutReading("一緒", "一起");
        long notAsked = insertWithoutReading("判断", "はんだん");
        long alreadyRead = cardService.create(userId, null, "食[た]べる", "吃").card().getId();

        CardService.CardReadings result =
                cardService.fillReadingsFor(userId, List.of(dueA, dueB, alreadyRead));

        assertEquals(List.of(
                        new CardService.CardReading(dueA, "めぐまれる"),
                        new CardService.CardReading(dueB, "いっしょ")),
                result.readings().stream()
                        .sorted(java.util.Comparator.comparing(CardService.CardReading::id))
                        .toList());
        assertNull(readings().get("判断"), "没点名的卡不该被补：" + notAsked);
    }

    @Test
    @DisplayName("别人的卡点了名也不补")
    void ignoresOtherUsersCards() {
        long mine = insertWithoutReading("判断", "はんだん");
        long otherUser = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt()));
        long theirs = cardService.create(otherUser, null, "理由", "りゆう").card().getId();
        jdbc.update("UPDATE card SET reading = NULL WHERE id = ?", theirs);

        CardService.CardReadings result = cardService.fillReadingsFor(userId, List.of(mine, theirs));

        assertEquals(List.of(new CardService.CardReading(mine, "はんだん")), result.readings());
        assertNull(jdbc.queryForObject("SELECT reading FROM card WHERE id = ?", String.class, theirs));

        jdbc.update("DELETE FROM user_card_state WHERE user_id = ?", otherUser);
        jdbc.update("DELETE FROM card WHERE owner_id = ?", otherUser);
        jdbc.update("DELETE FROM deck WHERE owner_id = ?", otherUser);
        jdbc.update("DELETE FROM app_user WHERE id = ?", otherUser);
    }

    @Test
    @DisplayName("改卡时填的读音存下来；留空就按新正面重新猜")
    void updateTakesUserReading() {
        long id = cardService.create(userId, null, "今日", "今天").card().getId();

        assertEquals("きょう／こんにち",
                cardService.update(userId, id, "今日", "今天", "きょう/こんにち").card().getReading());
        assertEquals("あした",
                cardService.update(userId, id, "明日[あした]", "明天", "").card().getReading());
    }

    /** 模拟迁移之前就有的卡：reading 是空的。 */
    private long insertWithoutReading(String front, String back) {
        long id = cardService.create(userId, null, front, back).card().getId();
        jdbc.update("UPDATE card SET reading = NULL WHERE id = ?", id);
        return id;
    }

    private Map<String, String> readings() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT front, reading FROM card WHERE owner_id = ? AND reading IS NOT NULL", userId);
        return rows.stream().collect(java.util.stream.Collectors.toMap(
                r -> (String) r.get("front"), r -> (String) r.get("reading")));
    }
}
