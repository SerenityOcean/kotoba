package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 学习节奏的设置：每天新词数。 */
@RestController
@RequestMapping("/api/study-settings")
public class StudySettingsController {

    private final StudyPlan plan;

    public StudySettingsController(StudyPlan plan) {
        this.plan = plan;
    }

    /** @param dailyNewLimit null = 不限 */
    public record Settings(Integer dailyNewLimit) {
    }

    @GetMapping
    public Settings get(@AuthenticationPrincipal AppUserPrincipal user) {
        return new Settings(plan.dailyNewLimit(user.id()));
    }

    @PutMapping
    public Settings put(@AuthenticationPrincipal AppUserPrincipal user, @RequestBody Settings body) {
        return new Settings(plan.setDailyNewLimit(user.id(), body.dailyNewLimit()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
        return new ApiError(e.getMessage());
    }
}
