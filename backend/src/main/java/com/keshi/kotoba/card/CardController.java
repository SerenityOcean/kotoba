package com.keshi.kotoba.card;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/cards")
public class CardController {

    private final CardService cardService;

    public CardController(CardService cardService) {
        this.cardService = cardService;
    }

    @GetMapping
    public List<CardResponse> list() {
        return cardService.findAll()
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @GetMapping("/due")
    public List<CardResponse> due() {
        return cardService.findDue(Instant.now())
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse create(@Valid @RequestBody CreateCardRequest request) {
        Card card = cardService.create(request.front(), request.back());
        return CardResponse.from(card);
    }
    @PostMapping("/import")
    public CardService.ImportResult importCards(@Valid @RequestBody ImportRequest request) {
        return cardService.importCards(request.cards(), Instant.now());
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        cardService.delete(id);
    }

    @PostMapping("/{id}/review")
    public CardResponse review(@PathVariable Long id, @Valid @RequestBody ReviewRequest request) {
        Card card = cardService.review(id, request.rating(), Instant.now());
        return CardResponse.from(card);
    }
}