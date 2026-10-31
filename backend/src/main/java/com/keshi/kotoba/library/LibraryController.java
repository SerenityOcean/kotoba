package com.keshi.kotoba.library;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.auth.TooManyAttemptsException;
import com.keshi.kotoba.library.LibraryViews.EssayView;
import com.keshi.kotoba.library.LibraryViews.ImportSummary;
import com.keshi.kotoba.library.LibraryViews.PackDetail;
import com.keshi.kotoba.library.LibraryViews.Redeemed;
import com.keshi.kotoba.library.LibraryViews.Shelf;
import com.keshi.kotoba.library.LibraryViews.Trial;
import com.keshi.kotoba.self.NotOwnerException;
import com.keshi.kotoba.self.SelfOwner;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 资料页。除了读随笔（谁都能读的那些没登录也行，SecurityConfig 单独放行了 GET），都要登录。
 * /admin 下面是主人传内容的口子，认人用 {@link SelfOwner}，和 /self 的随笔是同一个主人。
 */
@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final LibraryService library;
    private final LibraryAdminService admin;
    private final OrderService orders;
    private final SelfOwner owner;

    public LibraryController(LibraryService library, LibraryAdminService admin, OrderService orders,
                             SelfOwner owner) {
        this.library = library;
        this.admin = admin;
        this.orders = orders;
        this.owner = owner;
    }

    @GetMapping
    public Shelf shelf(@AuthenticationPrincipal AppUserPrincipal user) {
        return library.shelf(user.id(), owner.is(user));
    }

    @GetMapping("/packs/{slug}")
    public PackDetail pack(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug) {
        return library.pack(user.id(), slug, owner.is(user));
    }

    @GetMapping("/packs/{slug}/trial")
    public Trial trial(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug) {
        return library.trial(slug, owner.is(user));
    }

    /** 没登录时 user 是 null：谁都能读的随笔照样给。 */
    @GetMapping("/essays/{slug}")
    public EssayView essay(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug) {
        return library.essay(user == null ? null : user.id(), slug, owner.is(user));
    }

    @PostMapping("/packs/{slug}/import")
    public ImportSummary importPack(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug) {
        return library.importPack(user.id(), slug, Instant.now());
    }

    /** 集出现之前导入的文章：按导入过的包把还没进集的归进集里。 */
    @PostMapping("/file-articles")
    public Map<String, Integer> fileArticles(@AuthenticationPrincipal AppUserPrincipal user) {
        return Map.of("filed", library.fileImportedArticles(user.id()));
    }

    public record RedeemRequest(@NotBlank(message = "输入兑换码") String code) {
    }

    @PostMapping("/redeem")
    public Redeemed redeem(@AuthenticationPrincipal AppUserPrincipal user,
                           @Valid @RequestBody RedeemRequest request) {
        return library.redeem(user.id(), request.code(), Instant.now());
    }

    // ---- 支付宝 -----------------------------------------------------------

    /** @param mobile 手机上跳支付宝 App，电脑上给嵌入式二维码 */
    public record CheckoutRequest(boolean mobile) {
    }

    @PostMapping("/packs/{slug}/orders")
    public OrderService.Checkout checkout(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug,
                                          @RequestBody CheckoutRequest request) {
        return orders.checkout(user.id(), slug, request.mobile(), Instant.now());
    }

    @GetMapping("/orders/{orderNo}")
    public OrderService.OrderState order(@AuthenticationPrincipal AppUserPrincipal user,
                                         @PathVariable String orderNo) {
        return orders.state(user.id(), orderNo, Instant.now());
    }

    // ---- 主人 -------------------------------------------------------------

    public record Saved(String slug) {
    }

    @PutMapping("/admin/packs/{slug}")
    public Saved upsertPack(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug,
                            @Valid @RequestBody PackUpsertRequest request) {
        owner.check(user);
        return new Saved(admin.upsertPack(slug, request, Instant.now()).getSlug());
    }

    @PutMapping("/admin/essays/{slug}")
    public Saved upsertEssay(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug,
                             @Valid @RequestBody EssayUpsertRequest request) {
        owner.check(user);
        return new Saved(admin.upsertEssay(slug, request, Instant.now()).getSlug());
    }

    public record CodesRequest(int count) {
    }

    public record Codes(List<String> codes) {
    }

    @PostMapping("/admin/packs/{slug}/codes")
    public Codes codes(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String slug,
                       @RequestBody CodesRequest request) {
        owner.check(user);
        return new Codes(admin.createCodes(slug, request.count(), Instant.now()));
    }

    // ---- 出错 -------------------------------------------------------------

    @ExceptionHandler(LibraryNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    ApiError onNotFound(LibraryNotFoundException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler({LockedException.class, NotOwnerException.class})
    @ResponseStatus(HttpStatus.FORBIDDEN)
    ApiError onForbidden(RuntimeException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(AlreadyOwnedException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    ApiError onOwned(AlreadyOwnedException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(PaymentUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    ApiError onUnavailable(PaymentUnavailableException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    ApiError onTooMany(TooManyAttemptsException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
        return new ApiError(e.getMessage());
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
