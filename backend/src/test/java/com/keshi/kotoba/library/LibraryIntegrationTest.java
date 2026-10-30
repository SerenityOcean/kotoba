package com.keshi.kotoba.library;

import com.keshi.kotoba.auth.TooManyAttemptsException;
import com.keshi.kotoba.card.CreateCardRequest;
import com.keshi.kotoba.library.LibraryViews.EssayView;
import com.keshi.kotoba.library.LibraryViews.ImportSummary;
import com.keshi.kotoba.library.LibraryViews.PackCard;
import com.keshi.kotoba.library.LibraryViews.PackDetail;
import com.keshi.kotoba.library.LibraryViews.Shelf;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 资料包从上传、上架、解锁到导入走一遍，连真库（先 docker compose up）。 */
@SpringBootTest
class LibraryIntegrationTest {

    @Autowired
    private LibraryService library;

    @Autowired
    private LibraryAdminService admin;

    @Autowired
    private OrderService orders;

    @Autowired
    private PackOrderRepository orderRepository;

    @Autowired
    private Grants grants;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<Long> users = new ArrayList<>();
    private final List<String> packs = new ArrayList<>();
    private final List<String> essays = new ArrayList<>();
    private final Instant now = Instant.parse("2026-10-30T02:00:00Z");

    private long reader;
    private String slug;

    @BeforeEach
    void setUp() {
        reader = createUser();
        slug = upsertPack(Pack.Status.ON_SALE, 99);
    }

    @AfterEach
    void cleanUp() {
        for (String s : essays) {
            jdbc.update("DELETE FROM library_essay WHERE slug = ?", s);
        }
        // 包删了，解锁记录、订单、兑换码跟着删（ON DELETE CASCADE）
        for (String s : packs) {
            jdbc.update("DELETE FROM pack WHERE slug = ?", s);
        }
        for (long id : users) {
            jdbc.update("DELETE FROM user_card_state WHERE user_id = ?", id);
            jdbc.update("DELETE FROM card WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM deck WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM article WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM app_user WHERE id = ?", id);
        }
    }

    @Test
    @DisplayName("上传时文章注好音；书架上草稿只有主人看得见")
    void uploadsAndShelvesPacks() {
        String draft = upsertPack(Pack.Status.DRAFT, null);

        Shelf shelf = library.shelf(reader, false);
        PackCard card = find(shelf, slug);
        assertEquals(3, card.cardCount());
        assertEquals(2, card.articleCount());
        assertEquals(List.of("学校", "先生", "友達"), card.fan());
        assertFalse(card.owned());
        assertTrue(shelf.packs().stream().noneMatch(p -> p.slug().equals(draft)));
        assertTrue(library.shelf(reader, true).packs().stream().anyMatch(p -> p.slug().equals(draft)));
        assertThrows(LibraryNotFoundException.class, () -> library.pack(reader, draft, false));

        assertTrue(library.trial(slug, false).body().contains("毎朝[まいあさ]"));
    }

    @Test
    @DisplayName("要卖的包必须标价；slug 只认小写字母、数字、横线")
    void validatesUpload() {
        assertThrows(IllegalArgumentException.class, () -> upsertPack(Pack.Status.ON_SALE, null));
        assertThrows(IllegalArgumentException.class,
                () -> admin.upsertPack("Basics N5", request(Pack.Status.SOON, null), now));
    }

    @Test
    @DisplayName("谁都能读的随笔没登录也能读；包里的要解锁，主人不用")
    void gatesEssays() {
        String free = upsertEssay(null);
        String paid = upsertEssay(slug);

        EssayView view = library.essay(null, free, false);
        assertNull(view.pack());
        assertTrue(view.minutes() >= 1);

        assertThrows(LockedException.class, () -> library.essay(null, paid, false));
        assertThrows(LockedException.class, () -> library.essay(reader, paid, false));
        assertEquals(slug, library.essay(reader, paid, true).pack().slug());

        grants.grant(reader, packId(slug), Grants.Source.GIFT, null, now);
        assertEquals(paid, library.essay(reader, paid, false).slug());
        assertEquals(1, library.pack(reader, slug, false).essays().size());
    }

    @Test
    @DisplayName("没解锁不能导入；解锁后导入卡片和文章，再导一次只补新的，文章链到阅读列表")
    void importsAfterUnlock() {
        assertThrows(LockedException.class, () -> library.importPack(reader, slug, now));
        grants.grant(reader, packId(slug), Grants.Source.GIFT, null, now);

        PackDetail before = library.pack(reader, slug, false);
        assertTrue(before.card().owned());
        assertNull(before.importedAt());
        assertFalse(before.payable());

        ImportSummary first = library.importPack(reader, slug, now);
        assertEquals("测试基础词汇", first.deckName());
        assertEquals(3, first.cardsImported());
        assertEquals(2, first.articlesImported());

        ImportSummary again = library.importPack(reader, slug, now);
        assertEquals(0, again.cardsImported());
        assertEquals(3, again.cardsSkipped());
        assertEquals(2, again.articlesSkipped());

        PackDetail after = library.pack(reader, slug, false);
        assertNotNull(after.importedAt());
        assertEquals(first.deckId(), after.deckId());
        assertTrue(after.articles().stream().allMatch(a -> a.articleId() != null));
        // 阅读列表按保存时间倒序：包里第一篇排在最上面
        Long newest = jdbc.queryForObject(
                "SELECT id FROM article WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", Long.class, reader);
        assertEquals(after.articles().getFirst().articleId(), newest);
        // 读音建卡时就猜好了
        assertEquals("がっこう", jdbc.queryForObject(
                "SELECT reading FROM card WHERE owner_id = ? AND front = '学校'", String.class, reader));
    }

    @Test
    @DisplayName("兑换码：一张只能用一次；已经有这个包就不收码")
    void redeemsCodes() {
        List<String> codes = admin.createCodes(slug, 2, now);
        assertTrue(codes.getFirst().matches("[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}"));

        assertEquals(slug, library.redeem(reader, codes.getFirst().toLowerCase().replace("-", " "), now).slug());
        assertTrue(grants.owns(reader, packId(slug)));
        assertThrows(AlreadyOwnedException.class, () -> library.redeem(reader, codes.get(1), now));

        long other = createUser();
        assertThrows(IllegalArgumentException.class, () -> library.redeem(other, codes.getFirst(), now));
        assertEquals(slug, library.redeem(other, codes.get(1), now).slug());
        assertThrows(IllegalArgumentException.class, () -> library.redeem(other, "AAAA-BBBB-CCCC", now));
    }

    @Test
    @DisplayName("兑换码一个人一小时最多试 10 次，猜错的也算")
    void throttlesRedeem() {
        long guesser = createUser();
        for (int i = 0; i < LibraryService.REDEEM_PER_HOUR; i++) {
            assertThrows(IllegalArgumentException.class, () -> library.redeem(guesser, "AAAA-BBBB-CCCC", now));
        }
        assertThrows(TooManyAttemptsException.class,
                () -> library.redeem(guesser, "AAAA-BBBB-CCCC", now));
    }

    @Test
    @DisplayName("确认付款：金额对得上才发；同一笔确认两次只发一次")
    void confirmsPayments() {
        long packId = packId(slug);
        PackOrder order = orderRepository.save(new PackOrder("KBTEST" + random(), reader, packId, 99, now));

        assertFalse(orders.confirm(order.getOutTradeNo(), "T1", "0.01", now));
        assertFalse(grants.owns(reader, packId));

        assertTrue(orders.confirm(order.getOutTradeNo(), "T1", "0.99", now));
        assertTrue(orders.confirm(order.getOutTradeNo(), "T1", "0.99", now));
        assertTrue(grants.owns(reader, packId));
        assertEquals(Grants.Source.ALIPAY, grants.find(reader, packId).orElseThrow().source());
        assertEquals(PackOrder.Status.PAID, orderRepository.findByOutTradeNo(order.getOutTradeNo()).orElseThrow().getStatus());

        assertFalse(orders.confirm("KB-NOT-EXIST", "T2", "0.99", now));
    }

    @Test
    @DisplayName("没配支付宝：详情页不显示能买，下单回「还没开通」")
    void withoutAlipay() {
        assertFalse(library.pack(reader, slug, false).payable());
        assertThrows(PaymentUnavailableException.class, () -> orders.checkout(reader, slug, false, now));
    }

    // ---- 准备数据 ---------------------------------------------------------

    private String upsertPack(Pack.Status status, Integer price) {
        String s = "it-" + random();
        packs.add(s);
        admin.upsertPack(s, request(status, price), now);
        return s;
    }

    private static PackUpsertRequest request(Pack.Status status, Integer price) {
        PackContent content = new PackContent("测试基础词汇",
                List.of(new CreateCardRequest("学校", "がっこう\n名詞\n学校"),
                        new CreateCardRequest("先生", "せんせい\n名詞\n老师"),
                        new CreateCardRequest("友達", "ともだち\n名詞\n朋友")),
                List.of(new PackContent.Article("わたしの一日", "わたしは毎朝六時に起きます。"),
                        new PackContent.Article("駅までの道", "家を出て、右に曲がります。")));
        return new PackUpsertRequest("测试入门", "N5 · 入门", "あ", "sakura", "一句话", "一段话",
                status, price, null, 0, content);
    }

    private String upsertEssay(String pack) {
        String s = "it-essay-" + random();
        essays.add(s);
        admin.upsertEssay(s, new EssayUpsertRequest("先读，再背", pack,
                "## 一\n\n我背过三遍五十音。\n\n::: 例\n雨[あめ]が止[や]んだら。\n雨停了的话。\n:::",
                LocalDate.of(2026, 10, 30), 0), now);
        return s;
    }

    private long packId(String s) {
        return jdbc.queryForObject("SELECT id FROM pack WHERE slug = ?", Long.class, s);
    }

    private static PackCard find(Shelf shelf, String s) {
        return shelf.packs().stream().filter(p -> p.slug().equals(s)).findFirst().orElseThrow();
    }

    private long createUser() {
        long id = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, "it_" + random());
        users.add(id);
        return id;
    }

    private static String random() {
        return HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
    }
}
