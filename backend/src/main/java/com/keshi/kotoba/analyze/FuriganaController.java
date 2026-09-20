package com.keshi.kotoba.analyze;

import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 给一段日语加注音。和拆解共用模型引擎，但它是独立的一件事 ——
 * 阅读功能保存文章前按段落并行调这里。
 */
@RestController
@RequestMapping("/api/furigana")
public class FuriganaController {

    private final FuriganaService furiganaService;

    public FuriganaController(FuriganaService furiganaService) {
        this.furiganaService = furiganaService;
    }

    @PostMapping
    public FuriganaResult annotate(@Valid @RequestBody FuriganaRequest request) {
        return furiganaService.annotate(request.text());
    }

    @ExceptionHandler(AnalysisUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    ApiError onUnavailable(AnalysisUnavailableException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(AnalysisFailedException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    ApiError onFailed(AnalysisFailedException e) {
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
