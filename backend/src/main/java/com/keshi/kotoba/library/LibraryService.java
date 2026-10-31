package com.keshi.kotoba.library;

import com.keshi.kotoba.article.ArticleService;
import com.keshi.kotoba.auth.TooManyAttemptsException;
import com.keshi.kotoba.card.CardService;
import com.keshi.kotoba.card.Readings;
import com.keshi.kotoba.folder.Folder;
import com.keshi.kotoba.folder.FolderService;
import com.keshi.kotoba.library.LibraryViews.ArticleRow;
import com.keshi.kotoba.library.LibraryViews.CardPreview;
import com.keshi.kotoba.library.LibraryViews.EssayCard;
import com.keshi.kotoba.library.LibraryViews.EssayRef;
import com.keshi.kotoba.library.LibraryViews.EssayRow;
import com.keshi.kotoba.library.LibraryViews.EssayView;
import com.keshi.kotoba.library.LibraryViews.ImportSummary;
import com.keshi.kotoba.library.LibraryViews.PackCard;
import com.keshi.kotoba.library.LibraryViews.PackDetail;
import com.keshi.kotoba.library.LibraryViews.PackRef;
import com.keshi.kotoba.library.LibraryViews.Redeemed;
import com.keshi.kotoba.library.LibraryViews.Shelf;
import com.keshi.kotoba.library.LibraryViews.Trial;
import com.keshi.kotoba.pay.AlipayClient;
import com.keshi.kotoba.text.FuriganaNotation;
import com.keshi.kotoba.web.RateLimiter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 资料页：书架、资料包详情、试读、随笔，和解锁之后的导入、兑换码。
 *
 * <p>owner（{@link com.keshi.kotoba.self.SelfOwner} 认的那个人）看得见草稿，付费随笔也不用解锁 ——
 * 写完要能先看一眼排出来是什么样子。
 */
@Service
public class LibraryService {

    /** 详情页先给看几张卡。 */
    static final int PREVIEW_CARDS = 8;
    /** 书架卡片右上角露出几张。 */
    static final int FAN_CARDS = 3;
    static final int REDEEM_PER_HOUR = 10;

    private static final Comparator<LibraryEssay> FREE_ORDER = Comparator
            .comparingInt(LibraryEssay::getSort)
            .thenComparing(LibraryEssay::getPublishedAt, Comparator.nullsFirst(Comparator.reverseOrder()));
    private static final Comparator<LibraryEssay> PACK_ORDER = Comparator
            .comparingInt(LibraryEssay::getSort)
            .thenComparing(LibraryEssay::getPublishedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    private final PackRepository packs;
    private final LibraryEssayRepository essays;
    private final Grants grants;
    private final CardService cardService;
    private final ArticleService articleService;
    private final FolderService folderService;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ObjectProvider<AlipayClient> alipay;
    /**
     * 兑换码一个人一小时最多试这么多次。码有 31^12 种，本来就猜不中；
     * 限一下是不让人拿脚本对着接口刷，顺便把输错好几次的人拦下来看一眼。
     */
    private final RateLimiter redeemLimiter;

    public LibraryService(PackRepository packs, LibraryEssayRepository essays, Grants grants,
                          CardService cardService, ArticleService articleService,
                          FolderService folderService,
                          NamedParameterJdbcTemplate jdbc, ObjectMapper json,
                          ObjectProvider<AlipayClient> alipay, Clock clock) {
        this.packs = packs;
        this.essays = essays;
        this.grants = grants;
        this.cardService = cardService;
        this.articleService = articleService;
        this.folderService = folderService;
        this.jdbc = jdbc;
        this.json = json;
        this.alipay = alipay;
        this.redeemLimiter = new RateLimiter(REDEEM_PER_HOUR, Duration.ofHours(1), clock);
    }

    // ---- 读 -------------------------------------------------------------

    @Transactional(readOnly = true)
    public Shelf shelf(Long userId, boolean owner) {
        // 两张表都很小（包是个位数，随笔几十篇），整张读出来在这边分，比为每种查法写一个方法清楚
        List<LibraryEssay> all = essays.findAll();
        List<EssayCard> free = all.stream()
                .filter(e -> e.free() && (owner || e.published()))
                .sorted(FREE_ORDER)
                .map(LibraryService::essayCard)
                .toList();

        Map<Long, List<LibraryEssay>> packEssays = all.stream()
                .filter(e -> !e.free() && (owner || e.published()))
                .collect(Collectors.groupingBy(LibraryEssay::getPackId));
        Set<Long> owned = grants.ownedPackIds(userId);

        List<PackCard> cards = packs.findAll().stream()
                .filter(p -> owner || p.getStatus() != Pack.Status.DRAFT)
                .sorted(Comparator.comparingInt(Pack::getSort).thenComparing(Pack::getId))
                .map(p -> packCard(p, packEssays.getOrDefault(p.getId(), List.of()),
                        p.free() || owned.contains(p.getId())))
                .toList();
        return new Shelf(free, cards);
    }

    @Transactional(readOnly = true)
    public PackDetail pack(Long userId, String slug, boolean owner) {
        Pack pack = visiblePack(slug, owner);
        PackContent content = content(pack);
        Optional<Grants.Grant> grant = grants.find(userId, pack.getId());
        // 免费包谁都算拥有；导入过才有那行记录，所以「导入过没有」照样看 grant
        boolean owns = grant.isPresent() || pack.free();

        List<CardPreview> preview = content.cards().stream()
                .limit(PREVIEW_CARDS)
                .map(c -> new CardPreview(c.front(), Readings.guess(c.front(), c.back()), c.back()))
                .toList();

        // 解锁导入过的，文章链到用户阅读列表里那一篇（按标题认）
        Map<String, Long> imported = grant.isPresent()
                ? articleIdsByTitle(userId, content.articles().stream().map(PackContent.Article::title).toList())
                : Map.of();
        List<PackContent.Article> articles = content.articles();
        List<ArticleRow> rows = new ArrayList<>();
        for (int i = 0; i < articles.size(); i++) {
            PackContent.Article a = articles.get(i);
            String plain = FuriganaNotation.strip(a.body());
            rows.add(new ArticleRow(i, a.title(), plain.replaceAll("\\s+", "").length(),
                    EssayText.excerpt(a.body(), 60), imported.get(a.title())));
        }

        List<LibraryEssay> visibleEssays = packEssays(pack.getId(), owner);
        List<EssayRow> essayRows = visibleEssays.stream()
                .map(e -> new EssayRow(e.getSlug(), e.getTitle(), EssayText.excerpt(e.getBody(), 80),
                        EssayText.minutes(EssayText.chars(e.getBody()))))
                .toList();

        Long deckId = !owns ? null : jdbc.query(
                        "SELECT id FROM deck WHERE owner_id = :user AND name = :name",
                        new MapSqlParameterSource().addValue("user", userId).addValue("name", content.deckName()),
                        (rs, row) -> rs.getLong(1))
                .stream().findFirst().orElse(null);
        boolean payable = grant.isEmpty() && pack.onSale() && alipay.getIfAvailable() != null;
        return new PackDetail(
                packCard(pack, visibleEssays, owns),
                pack.getIntro(), content.deckName(), deckId, preview, rows, essayRows, payable,
                grant.map(Grants.Grant::grantedAt).orElse(null),
                grant.map(Grants.Grant::importedAt).orElse(null));
    }

    /** 包里第一篇文章：没解锁也能读完，知道里面的文章是什么样子。 */
    @Transactional(readOnly = true)
    public Trial trial(String slug, boolean owner) {
        Pack pack = visiblePack(slug, owner);
        PackContent.Article first = content(pack).articles().stream().findFirst()
                .orElseThrow(() -> new LibraryNotFoundException("这个包里没有文章"));
        return new Trial(first.title(), first.body(), packRef(pack, owner));
    }

    /**
     * 读一篇随笔。userId 为 null 是没登录：谁都能读的照样给，包里的要登录、要解锁。
     */
    @Transactional(readOnly = true)
    public EssayView essay(Long userId, String slug, boolean owner) {
        LibraryEssay essay = essays.findBySlug(slug)
                .filter(e -> owner || e.published())
                .orElseThrow(() -> new LibraryNotFoundException("没有这篇"));

        Pack pack = null;
        List<LibraryEssay> siblings;
        if (essay.free()) {
            siblings = essays.findAll().stream()
                    .filter(e -> e.free() && (owner || e.published()))
                    .sorted(FREE_ORDER)
                    .toList();
        } else {
            pack = packs.findById(essay.getPackId()).orElseThrow();
            if (!owner && !pack.free() && (userId == null || !grants.owns(userId, pack.getId()))) {
                throw new LockedException(userId == null
                        ? "这篇在「" + pack.getTitle() + "」里，登录并解锁之后可以读"
                        : "这篇在「" + pack.getTitle() + "」里，解锁之后可以读");
            }
            siblings = packEssays(pack.getId(), owner);
        }

        int at = siblings.indexOf(essay);
        LibraryEssay next = at >= 0 && at + 1 < siblings.size() ? siblings.get(at + 1) : null;
        int chars = EssayText.chars(essay.getBody());
        return new EssayView(essay.getSlug(), essay.getTitle(), essay.getBody(), essay.getPublishedAt(),
                chars, EssayText.minutes(chars), pack == null ? null : packRef(pack, owner),
                next == null ? null : new EssayRef(next.getSlug(), next.getTitle()));
    }

    // ---- 解锁之后 ---------------------------------------------------------

    /**
     * 把包里的卡片和文章复制进用户自己的账号。再导一次是安全的：
     * 包里已有的卡（按正面）、阅读里已有的同名文章都跳过 —— 包更新了，再导一次就只补新增的，
     * 用户改过的卡也不会被覆盖。
     */
    @Transactional
    public ImportSummary importPack(Long userId, String slug, Instant now) {
        Pack pack = packs.findBySlug(slug).orElseThrow(() -> new LibraryNotFoundException("没有这个资料包"));
        if (pack.free()) {
            // 免费包导入时补一行记录，「导入过没有」「什么时候导的」和付费包一样记
            grants.grant(userId, pack.getId(), Grants.Source.GIFT, "free", now);
        }
        if (!grants.owns(userId, pack.getId())) {
            throw new LockedException("先解锁「" + pack.getTitle() + "」");
        }
        PackContent content = content(pack);

        CardService.ImportResult cards = content.cards().isEmpty()
                ? null
                : cardService.importCards(userId, content.deckName(), content.cards(), now);

        // 以前导入过、还没进集的同名文章，这回顺手归进来
        fileUnfiled(userId, content);

        Set<String> existing = articleIdsByTitle(userId,
                content.articles().stream().map(PackContent.Article::title).toList()).keySet();
        int articlesImported = 0;
        // 一个包的文章进同一个集，集名就是包名，再导入也还是那一个
        Long folderId = content.articles().isEmpty() ? null
                : folderService.findOrCreate(userId, Folder.Kind.ARTICLE, content.deckName()).getId();
        // 阅读列表按保存时间倒序：倒着存，包里的第一篇才排在最上面
        for (PackContent.Article article : content.articles().reversed()) {
            if (!existing.contains(article.title())) {
                articleService.create(userId, article.title(), article.body(), null, folderId);
                articlesImported++;
            }
        }

        grants.markImported(userId, pack.getId(), now);
        return new ImportSummary(
                cards == null ? null : cards.deckId(),
                content.deckName(),
                cards == null ? 0 : cards.imported(),
                cards == null ? 0 : cards.skipped(),
                articlesImported,
                content.articles().size() - articlesImported);
    }

    /**
     * 用兑换码解锁。已经有这个包就不收这张码 —— 留着送人。
     * 用掉一张码是一条带条件的 UPDATE：两个人同时输同一张，只有一个改得动。
     */
    @Transactional
    public Redeemed redeem(Long userId, String rawCode, Instant now) {
        Duration blocked = redeemLimiter.tryAcquire("user:" + userId);
        if (blocked != null) {
            throw new TooManyAttemptsException(blocked);
        }
        String code = RedeemCodes.normalize(rawCode);
        Long packId = jdbc.query("SELECT pack_id FROM redeem_code WHERE code = :code",
                        new MapSqlParameterSource("code", code), (rs, row) -> rs.getLong(1))
                .stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("没有这个兑换码，看看是不是输错了"));
        Pack pack = packs.findById(packId).orElseThrow();
        if (grants.owns(userId, packId)) {
            throw new AlreadyOwnedException("你已经有「" + pack.getTitle() + "」了，这个码留着送人吧");
        }

        int used = jdbc.update("""
                UPDATE redeem_code SET used_by = :user, used_at = :now
                WHERE code = :code AND used_at IS NULL
                """, new MapSqlParameterSource()
                .addValue("user", userId)
                .addValue("now", Timestamp.from(now))
                .addValue("code", code));
        if (used == 0) {
            throw new IllegalArgumentException("这个兑换码已经用过了");
        }
        grants.grant(userId, packId, Grants.Source.CODE, code, now);
        return new Redeemed(pack.getSlug(), pack.getTitle());
    }

    // ---- 拼装 -------------------------------------------------------------

    private Pack visiblePack(String slug, boolean owner) {
        return packs.findBySlug(slug)
                .filter(p -> owner || p.getStatus() != Pack.Status.DRAFT)
                .orElseThrow(() -> new LibraryNotFoundException("没有这个资料包"));
    }

    private List<LibraryEssay> packEssays(Long packId, boolean owner) {
        return essays.findAll().stream()
                .filter(e -> packId.equals(e.getPackId()) && (owner || e.published()))
                .sorted(PACK_ORDER)
                .toList();
    }

    /**
     * 把导入过的包里、标题对得上又还没进集的文章，归进以包名命名的集。
     * 集出现之前导入的文章就靠这个整理回来；返回归了几篇。
     */
    @Transactional
    public int fileImportedArticles(Long userId) {
        int filed = 0;
        for (Long packId : grants.importedPackIds(userId)) {
            filed += packs.findById(packId).map(p -> fileUnfiled(userId, content(p))).orElse(0);
        }
        return filed;
    }

    private int fileUnfiled(Long userId, PackContent content) {
        if (content.articles().isEmpty()) {
            return 0;
        }
        List<Long> ids = new ArrayList<>();
        jdbc.query("""
                        SELECT id FROM article
                        WHERE owner_id = :user AND folder_id IS NULL AND title IN (:titles)
                        """,
                new MapSqlParameterSource().addValue("user", userId)
                        .addValue("titles", content.articles().stream().map(PackContent.Article::title).toList()),
                rs -> {
                    ids.add(rs.getLong("id"));
                });
        if (ids.isEmpty()) {
            return 0;
        }
        Long folderId = folderService.findOrCreate(userId, Folder.Kind.ARTICLE, content.deckName()).getId();
        return articleService.moveToFolder(userId, ids, folderId);
    }

    PackContent content(Pack pack) {
        return json.readValue(pack.getContent(), PackContent.class);
    }

    private PackCard packCard(Pack p, List<LibraryEssay> essays, boolean owned) {
        List<String> fan = content(p).cards().stream()
                .limit(FAN_CARDS)
                .map(c -> FuriganaNotation.strip(c.front()))
                .toList();
        return new PackCard(p.getSlug(), p.getTitle(), p.getLevel(), p.getGlyph(), p.getTint(),
                p.getSummary(), p.getStatus(), p.getPriceCents(), p.getNote(), p.getCardCount(),
                p.getArticleCount(), essays.size(), fan, owned, entry(p, essays));
    }

    private PackRef packRef(Pack pack, boolean owner) {
        return new PackRef(pack.getSlug(), pack.getTitle(), pack.getTint(),
                entry(pack, packEssays(pack.getId(), owner)));
    }

    /**
     * 没有卡片、没有文章、只有一篇随笔的包（比如五十音），没有可导入的东西，详情页就多余了：
     * 返回那篇随笔的 slug，前端点开包直接进随笔。其他包返回 null。
     */
    private static String entry(Pack p, List<LibraryEssay> essays) {
        return p.getCardCount() == 0 && p.getArticleCount() == 0 && essays.size() == 1
                ? essays.getFirst().getSlug()
                : null;
    }

    private static EssayCard essayCard(LibraryEssay e) {
        int chars = EssayText.chars(e.getBody());
        return new EssayCard(e.getSlug(), e.getTitle(), EssayText.excerpt(e.getBody(), 140), chars,
                EssayText.minutes(chars), e.getPublishedAt());
    }

    /** 用户阅读列表里这些标题各是哪篇。同名的有好几篇就取最早存的那篇。 */
    private Map<String, Long> articleIdsByTitle(Long userId, List<String> titles) {
        if (titles.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> found = new HashMap<>();
        jdbc.query("""
                        SELECT id, title FROM article
                        WHERE owner_id = :user AND title IN (:titles)
                        ORDER BY created_at
                        """,
                new MapSqlParameterSource().addValue("user", userId).addValue("titles", titles),
                rs -> {
                    found.putIfAbsent(rs.getString("title"), rs.getLong("id"));
                });
        return found;
    }
}
