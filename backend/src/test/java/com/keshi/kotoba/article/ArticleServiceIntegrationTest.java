package com.keshi.kotoba.article;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 字数统计是 Postgres 的 regexp_replace 在剥注音，翻页和邻居靠真的排序，
 * 所以连真库（要先 docker compose up 起本地库）。
 */
@SpringBootTest
class ArticleServiceIntegrationTest {

    @Autowired
    private ArticleService articleService;

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
            jdbc.update("DELETE FROM article WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM app_user WHERE id = ?", id);
        }
    }

    @Test
    @DisplayName("按保存时间倒序翻页，最后一页不满也照给")
    void pagesNewestFirst() {
        for (int day = 1; day <= 5; day++) {
            article(userId, "第" + day + "篇", "本文", "2026-09-0" + day + "T00:00:00Z");
        }

        Page<Article> first = articleService.page(userId, "", 0, 2);
        assertEquals(List.of("第5篇", "第4篇"), titles(first));
        assertEquals(3, first.getTotalPages());
        assertEquals(5, first.getTotalElements());

        assertEquals(List.of("第1篇"), titles(articleService.page(userId, "", 2, 2)));
    }

    @Test
    @DisplayName("按标题搜，不分大小写；% 和 _ 当普通字符")
    void searchesTitles() {
        article(userId, "NHK ニュース", "本文", "2026-09-01T00:00:00Z");
        article(userId, "読書の秋", "本文", "2026-09-02T00:00:00Z");
        article(userId, "100% の努力", "本文", "2026-09-03T00:00:00Z");

        assertEquals(List.of("NHK ニュース"), titles(articleService.page(userId, " nhk ", 0, 20)));
        assertEquals(List.of("100% の努力"), titles(articleService.page(userId, "%", 0, 20)));
        assertEquals(0, articleService.page(userId, "台風", 0, 20).getTotalElements());
    }

    @Test
    @DisplayName("统计：字数按剥掉注音算，别人的文章不算")
    void statsCountPlainCharacters() {
        // 「諦めた[注]」—— 方括号前面不是汉字，不是注音，要算字数
        article(userId, "a", "諦[あきら]めた[注]", "2026-09-01T00:00:00Z");
        article(userId, "b", "価値[かち]", "2026-09-02T00:00:00Z");
        article(createUser(), "c", "別人的文章", "2026-09-03T00:00:00Z");

        ArticleStats stats = articleService.stats(userId);

        assertEquals(2, stats.count());
        assertEquals("諦めた[注]".length() + "価値".length(), stats.chars());
        assertEquals(Instant.parse("2026-09-02T00:00:00Z"), stats.latest());
    }

    @Test
    @DisplayName("一篇都没有时统计是零，最近保存是 null")
    void statsWhenEmpty() {
        ArticleStats stats = articleService.stats(userId);

        assertEquals(0, stats.count());
        assertEquals(0, stats.chars());
        assertNull(stats.latest());
    }

    @Test
    @DisplayName("上一篇是更新的那篇、下一篇是更旧的那篇，别人的不算")
    void neighborsFollowListOrder() {
        long oldest = article(userId, "旧", "本文", "2026-09-01T00:00:00Z");
        long middle = article(userId, "中", "本文", "2026-09-02T00:00:00Z");
        long newest = article(userId, "新", "本文", "2026-09-03T00:00:00Z");
        article(createUser(), "别人的", "本文", "2026-09-02T12:00:00Z");

        ArticleNeighbors around = articleService.neighbors(userId, middle);
        assertEquals(new ArticleLink(newest, "新"), around.previous());
        assertEquals(new ArticleLink(oldest, "旧"), around.next());

        assertNull(articleService.neighbors(userId, newest).previous());
        assertNull(articleService.neighbors(userId, oldest).next());
    }

    @Test
    @DisplayName("改了内容，保存时间不动；改不了别人的")
    void updatesInPlace() {
        long id = article(userId, "旧标题", "旧正文", "2026-09-01T00:00:00Z");

        articleService.update(userId, id, "  新标题 ", "新正文", " ");

        Article updated = articleService.find(userId, id);
        assertEquals("新标题", updated.getTitle());
        assertEquals("新正文", updated.getBody());
        assertNull(updated.getSourceUrl());
        assertEquals(Instant.parse("2026-09-01T00:00:00Z"), updated.getCreatedAt());

        long other = createUser();
        assertThrows(ArticleNotFoundException.class,
                () -> articleService.update(other, id, "抢来的", "正文", null));
    }

    private long createUser() {
        String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        long id = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, username);
        createdUsers.add(id);
        return id;
    }

    private long article(long owner, String title, String body, String at) {
        return jdbc.queryForObject(
                "INSERT INTO article (owner_id, title, body, created_at) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, owner, title, body, Timestamp.from(Instant.parse(at)));
    }

    private static List<String> titles(Page<Article> page) {
        return page.getContent().stream().map(Article::getTitle).toList();
    }
}
