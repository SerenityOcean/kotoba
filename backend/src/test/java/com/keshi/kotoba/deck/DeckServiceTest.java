package com.keshi.kotoba.deck;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DeckServiceTest {

    private DeckRepository decks;
    private DeckService deckService;

    @BeforeEach
    void setUp() {
        decks = mock(DeckRepository.class);
        when(decks.save(any(Deck.class))).thenAnswer(call -> call.getArgument(0));
        deckService = new DeckService(decks);
    }

    @Test
    @DisplayName("导入同名包时复用已有的包，不会重复建")
    void findOrCreateReusesExistingDeck() {
        Deck existing = withId(7L, new Deck(1L, "N2日语动词150", Instant.now()));
        when(decks.findByOwnerIdAndName(1L, "N2日语动词150")).thenReturn(Optional.of(existing));

        Deck deck = deckService.findOrCreate(1L, "  N2日语动词150  ");

        assertSame(existing, deck);
        verify(decks, never()).save(any(Deck.class));
    }

    @Test
    @DisplayName("包名重复时建不出来")
    void createRejectsDuplicateName() {
        when(decks.existsByOwnerIdAndName(1L, "N2")).thenReturn(true);

        assertThrows(DeckNameTakenException.class, () -> deckService.create(1L, "N2"));
    }

    @Test
    @DisplayName("改名撞上别的包会冲突")
    void renameRejectsNameOfAnotherDeck() {
        Deck target = withId(1L, new Deck(1L, "旧名", Instant.now()));
        Deck other = withId(2L, new Deck(1L, "已占用", Instant.now()));
        when(decks.findByIdAndOwnerId(1L, 1L)).thenReturn(Optional.of(target));
        when(decks.findByOwnerIdAndName(1L, "已占用")).thenReturn(Optional.of(other));

        assertThrows(DeckNameTakenException.class, () -> deckService.rename(1L, 1L, "已占用"));
        assertEquals("旧名", target.getName());
    }

    @Test
    @DisplayName("改成自己当前的名字不算冲突（顺手 trim）")
    void renameToOwnNameIsAllowed() {
        Deck target = withId(1L, new Deck(1L, "旧名", Instant.now()));
        when(decks.findByIdAndOwnerId(1L, 1L)).thenReturn(Optional.of(target));
        when(decks.findByOwnerIdAndName(1L, "旧名")).thenReturn(Optional.of(target));

        assertEquals("旧名", deckService.rename(1L, 1L, "  旧名  ").getName());
    }

    @Test
    @DisplayName("空包名直接拒绝")
    void blankNameRejected() {
        assertThrows(IllegalArgumentException.class, () -> deckService.create(1L, "   "));
        verify(decks, never()).save(any(Deck.class));
    }

    @Test
    @DisplayName("默认包不存在时会补建一个")
    void defaultDeckIsCreatedOnDemand() {
        when(decks.findByOwnerIdAndName(anyLong(), anyString())).thenReturn(Optional.empty());

        assertEquals(Deck.DEFAULT_NAME, deckService.defaultDeck(9L).getName());
        verify(decks).save(any(Deck.class));
    }

    private static Deck withId(Long id, Deck deck) {
        try {
            Field field = Deck.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(deck, id);
            return deck;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
