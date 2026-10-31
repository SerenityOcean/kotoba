package com.keshi.kotoba.folder;

import com.keshi.kotoba.article.Article;
import com.keshi.kotoba.article.ArticleLink;
import com.keshi.kotoba.article.ArticleNeighbors;
import com.keshi.kotoba.article.ArticleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 集的计数靠真的 GROUP BY，删集靠外键 SET NULL，所以连真库。 */
@SpringBootTest
class FolderServiceIntegrationTest {

    @Autowired
    private FolderService folderService;

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
            jdbc.update("DELETE FROM folder WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM app_user WHERE id = ?", id);
        }
    }

    @Test
    @DisplayName("列表带每个集里有几个，没归档的单数")
    void listCountsPerFolder() {
        Folder n5 = folderService.create(userId, Folder.Kind.ARTICLE, " N5 物语 ");
        articleService.create(userId, "a", "本文", null, n5.getId());
        articleService.create(userId, "b", "本文", null, n5.getId());
        articleService.create(userId, "c", "本文", null);

        FolderListing listing = folderService.list(userId, Folder.Kind.ARTICLE);

        assertEquals("N5 物语", listing.folders().getFirst().name());
        assertEquals(2, listing.folders().getFirst().count());
        assertEquals(1, listing.unfiled());
        assertEquals(3, listing.total());
        assertEquals(0, folderService.list(userId, Folder.Kind.EXAM).total());
    }

    @Test
    @DisplayName("同一类里集名不能重，不同类可以；重名改名也拦")
    void namesAreUniquePerKind() {
        Folder first = folderService.create(userId, Folder.Kind.ARTICLE, "新闻");
        folderService.create(userId, Folder.Kind.EXAM, "新闻");
        Folder second = folderService.create(userId, Folder.Kind.ARTICLE, "小说");

        assertThrows(FolderNameTakenException.class,
                () -> folderService.create(userId, Folder.Kind.ARTICLE, "新闻"));
        assertThrows(FolderNameTakenException.class,
                () -> folderService.rename(userId, second.getId(), "新闻"));
        assertEquals("新闻", folderService.rename(userId, first.getId(), "新闻").getName());
    }

    @Test
    @DisplayName("删集不删文章，文章退回未归档")
    void deletingKeepsArticles() {
        Folder folder = folderService.create(userId, Folder.Kind.ARTICLE, "新闻");
        long id = articleService.create(userId, "a", "本文", null, folder.getId()).getId();

        folderService.delete(userId, folder.getId());

        assertNull(articleService.find(userId, id).getFolderId());
    }

    @Test
    @DisplayName("文章只能放进自己的、同一类的集")
    void rejectsForeignOrWrongKind() {
        Folder mine = folderService.create(userId, Folder.Kind.EXAM, "真题");
        Folder theirs = folderService.create(createUser(), Folder.Kind.ARTICLE, "别人的");

        assertThrows(FolderNotFoundException.class,
                () -> articleService.create(userId, "a", "本文", null, mine.getId()));
        assertThrows(FolderNotFoundException.class,
                () -> articleService.create(userId, "a", "本文", null, theirs.getId()));
    }

    @Test
    @DisplayName("按集看文章、统计和上一篇下一篇都只在这个集里")
    void scopesToFolder() {
        Folder folder = folderService.create(userId, Folder.Kind.ARTICLE, "连载");
        Long f = folder.getId();
        Article one = save(userId, "1", f, "2026-09-01T00:00:00Z");
        Article loose = save(userId, "散", null, "2026-09-02T00:00:00Z");
        Article two = save(userId, "2", f, "2026-09-03T00:00:00Z");
        Article stray = save(userId, "另一篇散的", null, "2026-09-04T00:00:00Z");

        assertEquals(List.of("2", "1"),
                articleService.page(userId, f, "", 0, 10).map(Article::getTitle).getContent());
        assertEquals(List.of("另一篇散的", "散"),
                articleService.page(userId, ArticleService.UNFILED, "", 0, 10)
                        .map(Article::getTitle).getContent());
        assertEquals(2, articleService.stats(userId, f).count());
        assertEquals(2, articleService.stats(userId, ArticleService.UNFILED).count());
        assertEquals(4, articleService.stats(userId).count());

        ArticleNeighbors inFolder = articleService.neighbors(userId, one.getId());
        assertEquals(new ArticleLink(two.getId(), "2"), inFolder.previous());
        assertNull(inFolder.next());
        ArticleNeighbors unfiled = articleService.neighbors(userId, loose.getId());
        assertEquals(new ArticleLink(stray.getId(), "另一篇散的"), unfiled.previous());
        assertNull(unfiled.next());
    }

    @Test
    @DisplayName("批量挪进集、退回未归档；别人的文章不动")
    void movesInBulk() {
        Folder folder = folderService.create(userId, Folder.Kind.ARTICLE, "新闻");
        long a = articleService.create(userId, "a", "本文", null).getId();
        long b = articleService.create(userId, "b", "本文", null).getId();
        long theirs = articleService.create(createUser(), "c", "本文", null).getId();

        assertEquals(2, articleService.moveToFolder(userId, List.of(a, b, theirs), folder.getId()));
        assertEquals(folder.getId(), articleService.find(userId, a).getFolderId());
        assertEquals(1, articleService.moveToFolder(userId, List.of(a), null));
        assertNull(articleService.find(userId, a).getFolderId());
        assertEquals(1, folderService.list(userId, Folder.Kind.ARTICLE).folders().getFirst().count());
    }

    private Article save(long owner, String title, Long folderId, String at) {
        Article article = articleService.create(owner, title, "本文", null, folderId);
        jdbc.update("UPDATE article SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.from(Instant.parse(at)), article.getId());
        return articleService.find(owner, article.getId());
    }

    private long createUser() {
        String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        long id = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, username);
        createdUsers.add(id);
        return id;
    }
}
