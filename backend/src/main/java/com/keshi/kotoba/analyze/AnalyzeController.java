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
 * 粘一段日语进来，拿回逐句的翻译 + 动词用法 + 语法点。
 * 拆解结果不落库 —— 想留下来的，前端勾选后走 /api/cards/import 建成卡片。
 */
@RestController
@RequestMapping("/api/analyze")
public class AnalyzeController {

    private final AnalyzeService analyzeService;

    public AnalyzeController(AnalyzeService analyzeService) {
        this.analyzeService = analyzeService;
    }

    @PostMapping
    public Analysis analyze(@Valid @RequestBody AnalyzeRequest request) {
        return analyzeService.analyze(request.text());
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
