package com.keshi.kotoba.article;

/** 上一篇/下一篇只要能点过去：id 和标题，不拖正文。 */
public record ArticleLink(Long id, String title) {
}
