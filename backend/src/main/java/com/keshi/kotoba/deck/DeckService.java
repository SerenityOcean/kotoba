package com.keshi.kotoba.deck;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class DeckService {

    private final DeckRepository decks;

    public DeckService(DeckRepository decks) {
        this.decks = decks;
    }

    /**
     * 没指定包时卡片的落脚点。V3 给每个存量用户建过，
     * 但之后注册的用户没有，所以这里补一个懒创建。
     */
    @Transactional
    public Deck defaultDeck(Long userId) {
        return decks.findByOwnerIdAndName(userId, Deck.DEFAULT_NAME)
                .orElseGet(() -> create(userId, Deck.DEFAULT_NAME));
    }

    /** 按名字取包，没有就建一个 —— 导入 Anki 包时用。 */
    @Transactional
    public Deck findOrCreate(Long userId, String rawName) {
        String name = normalize(rawName);
        return decks.findByOwnerIdAndName(userId, name)
                .orElseGet(() -> create(userId, name));
    }

    @Transactional
    public Deck create(Long userId, String rawName) {
        String name = normalize(rawName);
        if (decks.existsByOwnerIdAndName(userId, name)) {
            throw new DeckNameTakenException(name);
        }
        try {
            return decks.save(new Deck(userId, name, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // 同名并发创建，唯一约束兜住了
            throw new DeckNameTakenException(name);
        }
    }

    @Transactional
    public Deck rename(Long userId, Long deckId, String rawName) {
        String name = normalize(rawName);
        Deck deck = get(userId, deckId);

        Optional<Deck> clash = decks.findByOwnerIdAndName(userId, name);
        if (clash.isPresent() && !clash.get().getId().equals(deckId)) {
            throw new DeckNameTakenException(name);
        }

        deck.rename(name);
        return decks.save(deck);
    }

    @Transactional(readOnly = true)
    public List<Deck> list(Long userId) {
        return decks.findByOwnerIdOrderByCreatedAtAsc(userId);
    }

    @Transactional(readOnly = true)
    public Deck get(Long userId, Long deckId) {
        return decks.findByIdAndOwnerId(deckId, userId)
                .orElseThrow(() -> new DeckNotFoundException(deckId));
    }

    @Transactional
    public void delete(Long userId, Long deckId) {
        decks.delete(get(userId, deckId));
    }

    private static String normalize(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("包名不能为空");
        }
        return trimmed;
    }
}
