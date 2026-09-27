package com.keshi.kotoba.auth;

import com.keshi.kotoba.web.ApiError;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** auth 包里几个 controller 共用的错误映射。只管这个包，别的包各管各的。 */
@RestControllerAdvice(basePackageClasses = AuthController.class)
class AuthExceptionHandler {

    /** 用户名不存在和密码不对回同一句话，别泄露"这个用户名存在"。 */
    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    ApiError onBadCredentials() {
        return new ApiError("用户名或密码不正确");
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    ResponseEntity<ApiError> onTooManyAttempts(TooManyAttemptsException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(1, e.getRetryAfter().toSeconds())))
                .body(new ApiError(e.getMessage()));
    }

    @ExceptionHandler({UsernameTakenException.class, AccountConflictException.class})
    @ResponseStatus(HttpStatus.CONFLICT)
    ApiError onConflict(RuntimeException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler({WrongPasswordException.class, InvalidTokenException.class,
            IllegalArgumentException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onBadRequest(RuntimeException e) {
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
