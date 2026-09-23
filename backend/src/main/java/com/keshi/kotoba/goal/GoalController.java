package com.keshi.kotoba.goal;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/** 每人只有一个目标，所以是单数资源：没有 id，PUT 即立即改。 */
@RestController
@RequestMapping("/api/goal")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    /** 还没立目标回 204 —— 这不是错误，首页顶上什么都不显示就是了。 */
    @GetMapping
    public ResponseEntity<GoalResponse> get(@AuthenticationPrincipal AppUserPrincipal user) {
        return goalService.find(user.id())
                .map(goal -> ResponseEntity.ok(GoalResponse.from(goal)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public GoalResponse save(@AuthenticationPrincipal AppUserPrincipal user,
                             @Valid @RequestBody GoalRequest request) {
        return GoalResponse.from(
                goalService.save(user.id(), request.title(), request.targetDate(), Instant.now()));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal AppUserPrincipal user) {
        goalService.clear(user.id());
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
