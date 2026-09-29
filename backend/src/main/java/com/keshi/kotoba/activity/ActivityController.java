package com.keshi.kotoba.activity;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    /** GET /api/activity?from=2026-09-23&to=2026-09-29&tz=Asia/Shanghai */
    @GetMapping("/api/activity")
    public List<DailyActivity> daily(@AuthenticationPrincipal AppUserPrincipal user,
                                     @RequestParam LocalDate from,
                                     @RequestParam LocalDate to,
                                     @RequestParam String tz) {
        return activityService.daily(user.id(), from, to, tz);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
        return new ApiError(e.getMessage());
    }
}
