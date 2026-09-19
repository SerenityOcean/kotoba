package com.keshi.kotoba.deck;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.card.CardService;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/decks")
public class DeckController {

    private static final CardService.DeckCounts EMPTY = new CardService.DeckCounts(0, 0);

    private final DeckService deckService;
    private final CardService cardService;

    public DeckController(DeckService deckService, CardService cardService) {
        this.deckService = deckService;
        this.cardService = cardService;
    }

    @GetMapping
    public List<DeckResponse> list(@AuthenticationPrincipal AppUserPrincipal user) {
        Map<Long, CardService.DeckCounts> counts = cardService.countsByDeck(user.id(), Instant.now());

        return deckService.list(user.id()).stream()
                .map(deck -> {
                    CardService.DeckCounts c = counts.getOrDefault(deck.getId(), EMPTY);
                    return DeckResponse.from(deck, c.cards(), c.due());
                })
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DeckResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                               @Valid @RequestBody DeckRequest request) {
        return DeckResponse.from(deckService.create(user.id(), request.name()), 0, 0);
    }

    @PatchMapping("/{id}")
    public DeckResponse rename(@AuthenticationPrincipal AppUserPrincipal user,
                               @PathVariable Long id,
                               @Valid @RequestBody DeckRequest request) {
        Deck deck = deckService.rename(user.id(), id, request.name());
        CardService.DeckCounts counts = cardService.countsByDeck(user.id(), Instant.now())
                .getOrDefault(deck.getId(), EMPTY);
        return DeckResponse.from(deck, counts.cards(), counts.due());
    }

    // 下面几个异常都要把人话带到前端 —— Spring 默认的错误体里没有 message

    @ExceptionHandler(DeckNameTakenException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    ApiError onNameTaken(DeckNameTakenException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
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

    /** 删包会连里面的卡片一起删。 */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        cardService.deleteDeck(user.id(), id);
    }
}
