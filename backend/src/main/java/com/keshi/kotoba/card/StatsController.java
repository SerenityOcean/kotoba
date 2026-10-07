package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.AppUserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.keshi.kotoba.web.Zones;

import java.time.Instant;

@RestController
public class StatsController {

    private final CardService cardService;

    public StatsController(CardService cardService) {
        this.cardService = cardService;
    }

    /**
     * tz 是浏览器的时区（Asia/Shanghai），「今天」从那里的零点算起。
     * 没带或者不认识（比如还开着旧页面）就按 UTC，和以前一样，不报错 —— 首页不该因为它打不开。
     */
    @GetMapping("/api/stats")
    public CardService.Stats stats(@AuthenticationPrincipal AppUserPrincipal user,
                                   @RequestParam(required = false) String tz) {
        return cardService.stats(user.id(), Instant.now(), Zones.orUtc(tz));
    }
}