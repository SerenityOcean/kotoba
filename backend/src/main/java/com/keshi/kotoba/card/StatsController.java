package com.keshi.kotoba.card;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class StatsController {

    private final CardService cardService;

    public StatsController(CardService cardService) {
        this.cardService = cardService;
    }

    @GetMapping("/api/stats")
    public CardService.Stats stats() {
        return cardService.stats(Instant.now());
    }
}