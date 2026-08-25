package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
        return cardService.findAll(CurrentUser.id())
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @GetMapping("/due")
    public List<CardResponse> due() {
        return cardService.findDue(CurrentUser.id(), Instant.now())
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse create(@Valid @RequestBody CreateCardRequest request) {
        return CardResponse.from(
                cardService.create(CurrentUser.id(), request.front(), request.back()));
    }

    @PutMapping("/{id}")
    public CardResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCardRequest request) {
        return CardResponse.from(
                cardService.update(CurrentUser.id(), id, request.front(), request.back()));
    }

    @PostMapping("/import")
    public CardService.ImportResult importCards(@Valid @RequestBody ImportRequest request) {
        return cardService.importCards(CurrentUser.id(), request.cards(), Instant.now());
    }

    @PostMapping("/{id}/review")
    public CardResponse review(@PathVariable Long id, @Valid @RequestBody ReviewRequest request) {
        return CardResponse.from(
                cardService.review(CurrentUser.id(), id, request.rating(), Instant.now()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        cardService.delete(CurrentUser.id(), id);
    }
}