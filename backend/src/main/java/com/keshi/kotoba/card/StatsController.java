package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class StatsController {

    private final CardService cardService;
    private final CurrentUser currentUser;

    public StatsController(CardService cardService, CurrentUser currentUser) {
        this.cardService = cardService;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/stats")
    public CardService.Stats stats() {
        return cardService.stats(currentUser.id(), Instant.now());
    }
}