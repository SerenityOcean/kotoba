package com.keshi.kotoba.card;

import com.keshi.kotoba.analyze.AnalysisEngine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 补读音要走真的仓库查询（按 id 翻页、reading 为空），模型换成假的
 * （要先 docker compose up 起本地库）。
 */
@SpringBootTest
class CardReadingIntegrationTest {

    @Autowired
    private CardService cardService;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private AnalysisEngine engine;

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
    @DisplayName("建卡时能猜的当场猜好，不问模型")
    void guessesOnCreate() {
        assertEquals("たべる", cardService.create(userId, null, "食[た]べる", "吃").card().getReading());
        assertEquals("はんだん", cardService.create(userId, null, "判断", "はんだん 名詞").card().getReading());
        assertNull(cardService.create(userId, null, "戻す", "还原").card().getReading());
        verify(engine, never()).annotate(anyString(), anyString());
    }

    @Test
    @DisplayName("补读音：规则能猜的先猜，剩下的一次问模型，句子和全假名的跳过")
    void fillsByRuleThenModel() {
        insertWithoutReading("判断", "はんだん 名詞");
        insertWithoutReading("戻す", "还原");
        insertWithoutReading("一緒", "一起");
        insertWithoutReading("それでいて", "尽管如此");
        when(engine.annotate(anyString(), eq("戻す\n一緒")))
                .thenReturn("戻[もど]す\n\n一緒[いっしょ]");

        CardService.ReadingFill fill = cardService.fillReadings(userId, null, 50);

        assertEquals(1, fill.byRule());
        assertEquals(2, fill.byModel());
        assertEquals(0, fill.missed());
        assertNull(fill.nextAfterId(), "一批就翻完了");
        assertNull(fill.modelError());
        assertEquals(Map.of("判断", "はんだん", "戻す", "もどす", "一緒", "いっしょ"), readings());
    }

    @Test
    @DisplayName("模型漏注了的那张不要，别的照存")
    void dropsWordsTheModelSkipped() {
        insertWithoutReading("戻す", "还原");
        insertWithoutReading("一緒", "一起");
        // 「戻す」没注音，拼不出读音；「一緒」那行没问题
        when(engine.annotate(anyString(), anyString())).thenReturn("戻す\n一緒[いっしょ]");

        CardService.ReadingFill fill = cardService.fillReadings(userId, null, 50);

        assertEquals(1, fill.byModel());
        assertEquals(1, fill.missed());
        assertEquals(Map.of("一緒", "いっしょ"), readings());
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

        assertEquals(3, first.byRule() + second.byRule());
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
    private void insertWithoutReading(String front, String back) {
        long id = cardService.create(userId, null, front, back).card().getId();
        jdbc.update("UPDATE card SET reading = NULL WHERE id = ?", id);
    }

    private Map<String, String> readings() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT front, reading FROM card WHERE owner_id = ? AND reading IS NOT NULL", userId);
        return rows.stream().collect(java.util.stream.Collectors.toMap(
                r -> (String) r.get("front"), r -> (String) r.get("reading")));
    }
}
