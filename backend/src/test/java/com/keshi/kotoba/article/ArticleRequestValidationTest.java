package com.keshi.kotoba.article;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 原文链接会原样放进 <a href>，只收 http(s)。 */
class ArticleRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean valid(String sourceUrl) {
        return validator.validate(new ArticleRequest("标题", "正文", sourceUrl)).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  ", "https://www3.nhk.or.jp/news/", "http://example.com/a?b=c", "HTTPS://EXAMPLE.COM"})
    void acceptsHttpOrEmpty(String url) {
        assertTrue(valid(url), url);
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>", "ftp://x", "www.nhk.or.jp"})
    void rejectsOtherSchemes(String url) {
        assertFalse(valid(url), url);
    }
}
