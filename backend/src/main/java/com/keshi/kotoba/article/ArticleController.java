package com.keshi.kotoba.article;

import com.keshi.kotoba.auth.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 读过的文章。正文提交上来时已经注好音了 —— 注音由前端按段落并行调
 * /api/furigana 做完再提交，这边不碰模型。
 */
@RestController
@RequestMapping("/api/articles")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping
    public List<ArticleSummary> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return articleService.findAll(user.id()).stream()
                .map(ArticleSummary::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ArticleResponse get(@AuthenticationPrincipal AppUserPrincipal user,
                               @PathVariable Long id) {
        return ArticleResponse.from(articleService.find(user.id(), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ArticleResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                                  @Valid @RequestBody CreateArticleRequest request) {
        return ArticleResponse.from(articleService.create(
                user.id(), request.title(), request.body(), request.sourceUrl()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        articleService.delete(user.id(), id);
    }
}
