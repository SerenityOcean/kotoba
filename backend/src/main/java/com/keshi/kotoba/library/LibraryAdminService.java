package com.keshi.kotoba.library;

import com.keshi.kotoba.analyze.FuriganaService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 主人写内容：上传资料包、随笔，生成兑换码。没有后台页面，library/upload.py 从文件读出来发。
 * 都是整份覆盖（按 slug），同一份文件改了再传一次就是更新。
 */
@Service
public class LibraryAdminService {

    /** slug 会出现在地址栏里：小写字母、数字、横线。 */
    private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");
    private static final int MAX_SLUG = 60;
    /** 一次最多生成这么多张码。 */
    static final int MAX_CODES = 200;
    /** 「发出来的日子」按东八区的零点算。 */
    private static final ZoneId PUBLISH_ZONE = ZoneId.of("Asia/Shanghai");

    private final PackRepository packs;
    private final LibraryEssayRepository essays;
    private final FuriganaService furigana;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public LibraryAdminService(PackRepository packs, LibraryEssayRepository essays, FuriganaService furigana,
                               JdbcTemplate jdbc, ObjectMapper json) {
        this.packs = packs;
        this.essays = essays;
        this.furigana = furigana;
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * 上传一个包。文章的标题和正文在这里注音（原文自带的注音不动），
     * 导入的时候就只是复制，不用每个用户再跑一遍词典。
     */
    @Transactional
    public Pack upsertPack(String slug, PackUpsertRequest request, Instant now) {
        checkSlug(slug);
        if (request.status() == Pack.Status.ON_SALE && request.priceCents() == null) {
            throw new IllegalArgumentException("要卖的包得标个价（priceCents）");
        }

        PackContent given = request.content();
        List<PackContent.Article> articles = given.articles().stream()
                .map(a -> new PackContent.Article(
                        furigana.annotate(a.title()).text(),
                        furigana.annotate(normalize(a.body())).text()))
                .toList();
        PackContent content = new PackContent(given.deckName().strip(), given.cards(), articles);

        Pack pack = packs.findBySlug(slug).orElseGet(() -> new Pack(slug, now));
        pack.rewrite(request, json.writeValueAsString(content), content.cards().size(), articles.size(), now);
        return packs.save(pack);
    }

    @Transactional
    public LibraryEssay upsertEssay(String slug, EssayUpsertRequest request, Instant now) {
        checkSlug(slug);
        Long packId = null;
        if (request.pack() != null && !request.pack().isBlank()) {
            packId = packs.findBySlug(request.pack().strip())
                    .orElseThrow(() -> new IllegalArgumentException("没有叫 " + request.pack() + " 的资料包，先传包再传随笔"))
                    .getId();
        }
        Instant published = request.published() == null
                ? null
                : request.published().atStartOfDay(PUBLISH_ZONE).toInstant();

        LibraryEssay essay = essays.findBySlug(slug).orElseGet(() -> new LibraryEssay(slug));
        essay.rewrite(packId, request.title().strip(), normalize(request.body()), published,
                request.sort() == null ? 0 : request.sort(), now);
        return essays.save(essay);
    }

    /** 给一个包生成 count 张兑换码，返回给人看的样子（带横线）。 */
    @Transactional
    public List<String> createCodes(String packSlug, int count, Instant now) {
        if (count < 1 || count > MAX_CODES) {
            throw new IllegalArgumentException("一次生成 1 到 " + MAX_CODES + " 张");
        }
        Pack pack = packs.findBySlug(packSlug).orElseThrow(() -> new LibraryNotFoundException("没有这个资料包"));
        List<String> codes = new ArrayList<>();
        while (codes.size() < count) {
            String code = RedeemCodes.generate();
            // 31^12 个里撞上一个的概率可以忽略，撞了就换一个，不用报错
            int inserted = jdbc.update("""
                    INSERT INTO redeem_code (code, pack_id, created_at) VALUES (?, ?, ?)
                    ON CONFLICT (code) DO NOTHING
                    """, code, pack.getId(), Timestamp.from(now));
            if (inserted == 1) {
                codes.add(RedeemCodes.format(code));
            }
        }
        return codes;
    }

    private static void checkSlug(String slug) {
        if (slug == null || slug.length() > MAX_SLUG || !SLUG.matcher(slug).matches()) {
            throw new IllegalArgumentException("slug 只能用小写字母、数字和横线，比如 basics-n5");
        }
    }

    /** 换行统一成 \n，行尾空白去掉，首尾空白去掉。 */
    static String normalize(String text) {
        return text.replace("\r\n", "\n").replace('\r', '\n').replaceAll("[ \\t]+\\n", "\n").strip();
    }
}
