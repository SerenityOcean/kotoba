package com.keshi.kotoba.library;

import java.time.Instant;
import java.util.List;

/** 资料相关接口回给前端的形状。都是只读的小记录，放在一处好对照前端的 api.ts。 */
public final class LibraryViews {

    private LibraryViews() {
    }

    /** 资料页：上面是谁都能读的随笔，下面是资料包。 */
    public record Shelf(List<EssayCard> essays, List<PackCard> packs) {
    }

    public record EssayCard(String slug, String title, String excerpt, int chars, int minutes,
                            Instant publishedAt) {
    }

    /**
     * 书架上的一张卡。
     *
     * @param fan        封面右上角露出来的那几张卡的正面
     * @param priceCents 分；还在写的包可能没有
     */
    public record PackCard(String slug, String title, String level, String glyph, String tint,
                           String summary, Pack.Status status, Integer priceCents, String note,
                           int cardCount, int articleCount, int essayCount, List<String> fan,
                           boolean owned) {
    }

    /**
     * 资料包详情。
     *
     * @param deckId     用户自己那边叫 deckName 的卡包（导入之后才有），复习页按它筛
     * @param payable    现在能用支付宝买：在卖、还没解锁、后端配了支付宝
     * @param importedAt 解锁了但还没导入（付完钱就关了页面）时是 null
     */
    public record PackDetail(PackCard card, String intro, String deckName, Long deckId, List<CardPreview> cards,
                             List<ArticleRow> articles, List<EssayRow> essays, boolean payable,
                             Instant grantedAt, Instant importedAt) {
    }

    public record CardPreview(String front, String reading, String back) {
    }

    /**
     * @param articleId 解锁导入之后，用户阅读列表里对应那篇的 id（按标题找）；没有就是 null
     */
    public record ArticleRow(int index, String title, int chars, String peek, Long articleId) {
    }

    public record EssayRow(String slug, String title, String peek, int minutes) {
    }

    /** 包里第一篇文章，没解锁也能读。 */
    public record Trial(String title, String body, PackRef pack) {
    }

    public record PackRef(String slug, String title, String tint) {
    }

    public record EssayRef(String slug, String title) {
    }

    /**
     * 一篇随笔。
     *
     * @param pack 挂在哪个包上；谁都能读的是 null
     * @param next 同一处（谁都能读的那几篇，或者同一个包里）的下一篇
     */
    public record EssayView(String slug, String title, String body, Instant publishedAt, int chars,
                            int minutes, PackRef pack, EssayRef next) {
    }

    public record ImportSummary(Long deckId, String deckName, int cardsImported, int cardsSkipped,
                                int articlesImported, int articlesSkipped) {
    }

    public record Redeemed(String slug, String title) {
    }
}
