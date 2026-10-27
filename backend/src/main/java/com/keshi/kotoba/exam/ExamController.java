package com.keshi.kotoba.exam;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 应试：导入的读解真题。卷子在前端解析、注好音再提交；判分在这边，
 * 按存下的答案算，交卷记录和分数一起存。
 */
@RestController
@RequestMapping("/api/exams")
public class ExamController {

    private final ExamService examService;

    public ExamController(ExamService examService) {
        this.examService = examService;
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
        return examService.create(user.id(), request.title(), request.content());
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
