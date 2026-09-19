package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    /** deckId 不传就是全部包。 */
    @GetMapping
    public List<CardResponse> list(@AuthenticationPrincipal AppUserPrincipal user,
                                   @RequestParam(required = false) Long deckId) {
        return cardService.findAll(user.id(), deckId)
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @GetMapping("/due")
    public List<CardResponse> due(@AuthenticationPrincipal AppUserPrincipal user,
                                  @RequestParam(required = false) Long deckId) {
        return cardService.findDue(user.id(), deckId, Instant.now())
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                               @RequestParam(required = false) Long deckId,
                               @Valid @RequestBody CreateCardRequest request) {
        return CardResponse.from(
                cardService.create(user.id(), deckId, request.front(), request.back()));
    }

    @PutMapping("/{id}")
    public CardResponse update(@AuthenticationPrincipal AppUserPrincipal user,
                               @PathVariable Long id,
                               @Valid @RequestBody UpdateCardRequest request) {
        return CardResponse.from(
                cardService.update(user.id(), id, request.front(), request.back()));
    }

    @PostMapping("/import")
    public CardService.ImportResult importCards(@AuthenticationPrincipal AppUserPrincipal user,
                                                @Valid @RequestBody ImportRequest request) {
        return cardService.importCards(user.id(), request.deckName(), request.cards(), Instant.now());
    }

    @PostMapping("/{id}/review")
    public CardResponse review(@AuthenticationPrincipal AppUserPrincipal user,
                               @PathVariable Long id,
                               @Valid @RequestBody ReviewRequest request) {
        return CardResponse.from(
                cardService.review(user.id(), id, request.rating(), Instant.now()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        cardService.delete(user.id(), id);
    }
}
