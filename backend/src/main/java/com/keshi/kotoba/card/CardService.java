package com.keshi.kotoba.card;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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

    public CardService(CardRepository cardRepository,
                       UserCardStateRepository stateRepository,
                       ReviewLogRepository reviewLogRepository) {
        this.cardRepository = cardRepository;
        this.stateRepository = stateRepository;
        this.reviewLogRepository = reviewLogRepository;
    }

    @Transactional(readOnly = true)
    public List<CardWithState> findAll(Long userId) {
        List<Card> cards = cardRepository.findByOwnerIdOrderByCreatedAtDesc(userId);
        Map<Long, UserCardState> byCardId = stateRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(UserCardState::getCardId, Function.identity()));
        // 不变量：每张卡都有对应的 state（建卡时一起建，V2 迁移时一起搬）
        return cards.stream()
                .map(c -> new CardWithState(c, byCardId.get(c.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CardWithState> findDue(Long userId, Instant now) {
        // 先查状态表（排序条件在这边），再按 id 捞回卡片内容
        List<UserCardState> dueStates =
                stateRepository.findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(userId, now);

        List<Long> cardIds = dueStates.stream().map(UserCardState::getCardId).toList();
        Map<Long, Card> byId = cardRepository.findAllById(cardIds).stream()
                .collect(Collectors.toMap(Card::getId, Function.identity()));

        // 遍历 dueStates 而不是 byId，保住 dueAt 升序
        return dueStates.stream()
                .map(s -> new CardWithState(byId.get(s.getCardId()), s))
                .toList();
    }

    @Transactional
    public CardWithState create(Long userId, String front, String back) {
        Instant now = Instant.now();
        Card card = cardRepository.save(new Card(userId, front, back, now));
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

    @Transactional
    public ImportResult importCards(Long userId, List<CreateCardRequest> requests, Instant now) {
        // 1. 批次内去重，保留第一次出现的
        Map<String, CreateCardRequest> unique = new LinkedHashMap<>();
        for (CreateCardRequest request : requests) {
            unique.putIfAbsent(request.front().trim(), request);
        }

        // 2. 一次查出这个用户库里已有哪些
        Set<String> existing = cardRepository.findExistingFronts(userId, unique.keySet());

        // 3. 分成要导入的和要跳过的
        List<Card> toSave = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (Map.Entry<String, CreateCardRequest> entry : unique.entrySet()) {
            String front = entry.getKey();
            if (existing.contains(front)) {
                skipped.add(front);
            } else {
                String back = entry.getValue().back();
                toSave.add(new Card(userId, front, back == null ? null : back.trim(), now));
            }
        }

        List<Card> saved = cardRepository.saveAll(toSave);
        stateRepository.saveAll(saved.stream()
                .map(c -> new UserCardState(userId, c.getId(), now))
                .toList());

        return new ImportResult(saved.size(), skipped.size(), skipped);
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

    public record ImportResult(int imported, int skipped, List<String> skippedFronts) {
    }
}