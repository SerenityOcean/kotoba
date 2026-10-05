package com.keshi.kotoba.article;

/**
 * 读完一篇往哪儿走。顺序和列表一样是保存时间倒序，
 * 所以 previous 是更新的那篇，next 是更旧的那篇；到头了是 null。
 */
public record ArticleNeighbors(ArticleLink previous, ArticleLink next) {
}
