package com.keshi.kotoba.article;

import java.util.List;

/**
 * 列表的一页。
 *
 * @param page       第几页，从 0 数
 * @param totalPages 按当前搜索词一共几页
 * @param total      按当前搜索词一共几篇
 */
public record ArticleListResponse(List<ArticleSummary> articles, int page, int totalPages, long total) {
}
