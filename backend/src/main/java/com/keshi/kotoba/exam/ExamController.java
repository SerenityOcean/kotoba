package com.keshi.kotoba.exam;

import com.keshi.kotoba.analyze.AnalysisFailedException;
import com.keshi.kotoba.analyze.AnalysisUnavailableException;
import com.keshi.kotoba.analyze.AnalyzeLimitException;
import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 应试：导入的读解真题。卷子在前端解析、注好音再提交；判分在这边，
 * 按存下的答案算，成绩记录和分数一起存。每道题还能自己标个难度、让模型写解析。
 */
@RestController
@RequestMapping("/api/exams")
public class ExamController {

    private final ExamService examService;
    private final ExplanationService explanationService;

    public ExamController(ExamService examService, ExplanationService explanationService) {
        this.examService = examService;
        this.explanationService = explanationService;
    }

    @GetMapping
    public List<ExamSummary> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return examService.list(user.id());
    }

    @GetMapping("/{id}")
    public ExamResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return examService.find(user.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExamResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                               @Valid @RequestBody ExamRequest request) {
        return examService.create(user.id(), request.title(), request.content(),
                request.folderId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        examService.delete(user.id(), id);
    }

    @PostMapping("/{id}/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptResponse submit(@AuthenticationPrincipal AppUserPrincipal user,
                                  @PathVariable Long id,
                                  @Valid @RequestBody AttemptRequest request) {
        return examService.submit(user.id(), id, request.answers(), request.elapsedSeconds());
    }

    @PutMapping("/{id}/marks/{number}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void mark(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                     @PathVariable int number, @Valid @RequestBody MarkRequest request) {
        examService.mark(user.id(), id, number, request.level());
    }

    @DeleteMapping("/{id}/marks/{number}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unmark(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                       @PathVariable int number) {
        examService.unmark(user.id(), id, number);
    }

    /** 一道题的解析：生成过的直接给，没有的现调模型，要十几秒。 */
    @PostMapping("/{id}/questions/{number}/explanation")
    public QuestionExplanation explain(@AuthenticationPrincipal AppUserPrincipal user,
                                       @PathVariable Long id, @PathVariable int number) {
        return explanationService.explain(user.id(), id, number);
    }

    @ExceptionHandler(AnalyzeLimitException.class)
    ResponseEntity<ApiError> onLimit(AnalyzeLimitException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(1, e.getRetryAfter().toSeconds())))
                .body(new ApiError(e.getMessage()));
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

    @ExceptionHandler(InvalidExamException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onInvalidExam(InvalidExamException e) {
        return new ApiError(e.getMessage());
    }
}
