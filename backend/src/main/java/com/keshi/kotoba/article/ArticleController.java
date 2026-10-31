package com.keshi.kotoba.article;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

    /**
     * 一页摘要。q 按标题筛，不分大小写。folder 不传是全部，传 0 是未归档，传集 id 就只看那个集。
     */
    @GetMapping
    public ArticleListResponse list(@AuthenticationPrincipal AppUserPrincipal user,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(defaultValue = "") String q,
                                    @RequestParam(required = false) Long folder) {
        Page<Article> found = articleService.page(user.id(), folder, q, page, size);
        return new ArticleListResponse(
                found.getContent().stream().map(ArticleSummary::from).toList(),
                found.getNumber(),
                found.getTotalPages(),
                found.getTotalElements());
    }

    @GetMapping("/stats")
    public ArticleStats stats(@AuthenticationPrincipal AppUserPrincipal user,
                              @RequestParam(required = false) Long folder) {
        return articleService.stats(user.id(), folder);
    }

    @GetMapping("/{id}")
    public ArticleResponse get(@AuthenticationPrincipal AppUserPrincipal user,
                               @PathVariable Long id) {
        return ArticleResponse.from(articleService.find(user.id(), id));
    }

    @GetMapping("/{id}/neighbors")
    public ArticleNeighbors neighbors(@AuthenticationPrincipal AppUserPrincipal user,
                                      @PathVariable Long id) {
        return articleService.neighbors(user.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ArticleResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                                  @Valid @RequestBody ArticleRequest request) {
        return ArticleResponse.from(articleService.create(
                user.id(), request.title(), request.body(), request.sourceUrl(), request.folderId()));
    }

    @PutMapping("/{id}")
    public ArticleResponse update(@AuthenticationPrincipal AppUserPrincipal user,
                                  @PathVariable Long id,
                                  @Valid @RequestBody ArticleRequest request) {
        return ArticleResponse.from(articleService.update(
                user.id(), id, request.title(), request.body(), request.sourceUrl()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        articleService.delete(user.id(), id);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onInvalidRequest(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst()
                .orElse("请求参数不合法");
        return new ApiError(message);
    }
}
