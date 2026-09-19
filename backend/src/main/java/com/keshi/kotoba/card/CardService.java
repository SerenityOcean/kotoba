package com.keshi.kotoba.card;

import com.keshi.kotoba.deck.Deck;
import com.keshi.kotoba.deck.DeckService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CardService {

    private final CardRepository cardRepository;
    private final UserCardStateRepository stateRepository;
    private final ReviewLogRepository reviewLogRepository;
    private final DeckService deckService;

    public CardService(CardRepository cardRepository,
                       UserCardStateRepository stateRepository,
                       ReviewLogRepository reviewLogRepository,
                       DeckService deckService) {
        this.cardRepository = cardRepository;
        this.stateRepository = stateRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.deckService = deckService;
    }

    /** deckId 为 null 表示不限包。 */
    @Transactional(readOnly = true)
    public List<CardWithState> findAll(Long userId, Long deckId) {
        List<Card> cards = deckId == null
                ? cardRepository.findByOwnerIdOrderByCreatedAtDesc(userId)
                // 先校验包归属，再按包查，免得拿别人的包 id 来翻卡片
                : cardRepository.findByDeckIdOrderByCreatedAtDesc(deckService.get(userId, deckId).getId());

        Map<Long, UserCardState> byCardId = stateRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(UserCardState::getCardId, Function.identity()));
        // 不变量：每张卡都有对应的 state（建卡时一起建，V2 迁移时一起搬）
        return cards.stream()
                .map(c -> new CardWithState(c, byCardId.get(c.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CardWithState> findDue(Long userId, Long deckId, Instant now) {
        // 先查状态表（排序条件在这边），再按 id 捞回卡片内容
        List<UserCardState> dueStates = deckId == null
                ? stateRepository.findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(userId, now)
                : stateRepository.findDueByDeck(userId, deckService.get(userId, deckId).getId(), now);

        List<Long> cardIds = dueStates.stream().map(UserCardState::getCardId).toList();
        Map<Long, Card> byId = cardRepository.findAllById(cardIds).stream()
                .collect(Collectors.toMap(Card::getId, Function.identity()));

        // 遍历 dueStates 而不是 byId，保住 dueAt 升序
        return dueStates.stream()
                .map(s -> new CardWithState(byId.get(s.getCardId()), s))
                .toList();
    }

    /** deckId 为 null 就放进默认包。 */
    @Transactional
    public CardWithState create(Long userId, Long deckId, String front, String back) {
        Instant now = Instant.now();
        Deck deck = deckId == null ? deckService.defaultDeck(userId) : deckService.get(userId, deckId);

        Card card = cardRepository.save(new Card(userId, deck.getId(), front, back, now));
        UserCardState state = stateRepository.save(new UserCardState(userId, card.getId(), now));
        return new CardWithState(card, state);
    }

    @Transactional
    public CardWithState update(Long userId, Long id, String front, String back) {
        Card card = cardRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new CardNotFoundException(id));
        card.updateContent(front, back);
        cardRepository.save(card);
        UserCardState state = stateRepository.findByUserIdAndCardId(userId, id)
                .orElseThrow(() -> new CardNotFoundException(id));
        return new CardWithState(card, state);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Card card = cardRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new CardNotFoundException(id));
        reviewLogRepository.deleteByCardId(id);
        stateRepository.deleteByCardId(id);
        cardRepository.delete(card);
    }

    @Transactional
    public CardWithState review(Long userId, Long id, Rating rating, Instant now) {
        Card card = cardRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new CardNotFoundException(id));
        UserCardState state = stateRepository.findByUserIdAndCardId(userId, id)
                .orElseThrow(() -> new CardNotFoundException(id));

        int newInterval = state.applyReview(rating, now);

        reviewLogRepository.save(new ReviewLog(userId, id, now, rating, newInterval));
        stateRepository.save(state);

        return new CardWithState(card, state);
    }

    /**
     * 批量导入。deckName 为空就进默认包，否则按名字找包、没有就新建
     * —— 导入 Anki 包时用包名，这样一个包就是一组卡片。
     */
    @Transactional
    public ImportResult importCards(Long userId, String deckName,
                                    List<CreateCardRequest> requests, Instant now) {
        Deck deck = deckName == null || deckName.isBlank()
                ? deckService.defaultDeck(userId)
                : deckService.findOrCreate(userId, deckName);

        // 1. 批次内去重，保留第一次出现的
        Map<String, CreateCardRequest> unique = new LinkedHashMap<>();
        for (CreateCardRequest request : requests) {
            unique.putIfAbsent(request.front().trim(), request);
        }

        // 2. 一次查出这个包里已有哪些
        Set<String> existing = cardRepository.findExistingFronts(deck.getId(), unique.keySet());

        // 3. 分成要导入的和要跳过的
        List<Card> toSave = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (Map.Entry<String, CreateCardRequest> entry : unique.entrySet()) {
            String front = entry.getKey();
            if (existing.contains(front)) {
                skipped.add(front);
            } else {
                String back = entry.getValue().back();
                toSave.add(new Card(userId, deck.getId(), front, back == null ? null : back.trim(), now));
            }
        }

        List<Card> saved = cardRepository.saveAll(toSave);
        stateRepository.saveAll(saved.stream()
                .map(c -> new UserCardState(userId, c.getId(), now))
                .toList());

        return new ImportResult(deck.getId(), deck.getName(), saved.size(), skipped.size(), skipped);
    }

    /** 删包连卡片一起删 —— 包是卡片的容器，空留一个壳没意义。 */
    @Transactional
    public void deleteDeck(Long userId, Long deckId) {
        Deck deck = deckService.get(userId, deckId);
        List<Long> cardIds = cardRepository.findIdsByDeckId(deck.getId());

        if (!cardIds.isEmpty()) {
            reviewLogRepository.deleteByCardIdIn(cardIds);
            stateRepository.deleteByCardIdIn(cardIds);
            cardRepository.deleteByDeckId(deck.getId());
        }
        deckService.delete(userId, deck.getId());
    }

    /** 每个包的卡片数和到期数，列表页一次算完。 */
    @Transactional(readOnly = true)
    public Map<Long, DeckCounts> countsByDeck(Long userId, Instant now) {
        Map<Long, DeckCounts> result = new HashMap<>();

        for (DeckCount row : cardRepository.countByDeck(userId)) {
            result.put(row.getDeckId(), new DeckCounts(row.getCount(), 0));
        }
        for (DeckCount row : stateRepository.countDueByDeck(userId, now)) {
            DeckCounts current = result.getOrDefault(row.getDeckId(), new DeckCounts(0, 0));
            result.put(row.getDeckId(), new DeckCounts(current.cards(), row.getCount()));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Stats stats(Long userId, Instant now) {
        long total = cardRepository.countByOwnerId(userId);
        long due = stateRepository.countByUserIdAndDueAtLessThanEqual(userId, now);
        long reviewedToday = reviewLogRepository.countByUserIdAndReviewedAtGreaterThanEqual(
                userId, now.truncatedTo(ChronoUnit.DAYS));
        return new Stats(total, due, reviewedToday);
    }

    /** 卡片内容 + 当前用户在它上面的进度。HTTP 层要把两者拼成一个响应。 */
    public record CardWithState(Card card, UserCardState state) {
    }

    public record Stats(long totalCards, long dueToday, long reviewedToday) {
    }

    public record DeckCounts(long cards, long due) {
    }

    public record ImportResult(Long deckId, String deckName,
                               int imported, int skipped, List<String> skippedFronts) {
    }
}
