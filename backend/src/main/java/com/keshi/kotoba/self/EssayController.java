package com.keshi.kotoba.self;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
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

import java.time.Instant;

/**
 * self 的随笔。读不用登录（SecurityConfig 里单独放行了 GET），
 * 写、改、删要登录，而且得是 {@link SelfOwner} 认的那个人。
 */
@RestController
@RequestMapping("/api/self/essays")
public class EssayController {

    private final EssayService essayService;
    private final SelfOwner owner;

    public EssayController(EssayService essayService, SelfOwner owner) {
        this.essayService = essayService;
        this.owner = owner;
    }

    /** 没登录时 user 是 null。 */
    @GetMapping
    public EssayListResponse list(@AuthenticationPrincipal AppUserPrincipal user,
                                  @RequestParam(required = false) Long before,
                                  @RequestParam(defaultValue = "60") int limit) {
        EssayService.EssayPage page = essayService.page(before, limit);
        return new EssayListResponse(
                page.essays().stream().map(EssayResponse::from).toList(),
                page.hasMore(),
                page.total(),
                owner.is(user));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EssayResponse write(@AuthenticationPrincipal AppUserPrincipal user,
                               @Valid @RequestBody EssayRequest request) {
        owner.check(user);
        return EssayResponse.from(essayService.write(request.body(), Instant.now()));
    }

    @PutMapping("/{id}")
    public EssayResponse revise(@AuthenticationPrincipal AppUserPrincipal user,
                                @PathVariable Long id,
                                @Valid @RequestBody EssayRequest request) {
        owner.check(user);
        return EssayResponse.from(essayService.revise(id, request.body(), Instant.now()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        owner.check(user);
        essayService.delete(id);
    }

    @ExceptionHandler(NotOwnerException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    ApiError onNotOwner(NotOwnerException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(EssayNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    ApiError onNotFound(EssayNotFoundException e) {
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
