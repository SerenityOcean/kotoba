package com.keshi.kotoba.article;

import java.time.Instant;

/**
 * 阅读页顶上那几个数。列表分页以后前端手里只有一页，凑不出总数，
 * 所以由后端算。
 *
 * @param latest 最近一次保存，一篇都没有时是 null
 */
public record ArticleStats(long count, long chars, Instant latest) {
}
