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

@Service
public class CardService {

    private final CardRepository cardRepository;
    private final ReviewLogRepository reviewLogRepository;

    public CardService(CardRepository cardRepository, ReviewLogRepository reviewLogRepository) {
        this.cardRepository = cardRepository;
        this.reviewLogRepository = reviewLogRepository;
    }

    public List<Card> findAll() {
        return cardRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Card> findDue(Instant now) {
        return cardRepository.findByDueAtLessThanEqualOrderByDueAtAsc(now);
    }

    @Transactional
    public Card create(String front, String back) {
        Card card = new Card(front, back, Instant.now());
        return cardRepository.save(card);
    }

    @Transactional
    public void delete(Long id) {
        if (!cardRepository.existsById(id)) {
            throw new CardNotFoundException(id);
        }
        reviewLogRepository.deleteByCardId(id);
        cardRepository.deleteById(id);
    }

    @Transactional
    public Card review(Long id, Rating rating, Instant now) {
        Card card = cardRepository.findById(id)
                .orElseThrow(() -> new CardNotFoundException(id));

        int newInterval = card.applyReview(rating, now);

        reviewLogRepository.save(new ReviewLog(card.getId(), now, rating, newInterval));

        return cardRepository.save(card);
    }

    @Transactional
    public ImportResult importCards(List<CreateCardRequest> requests, Instant now) {
        // 1. 批次内去重，保留第一次出现的
        Map<String, CreateCardRequest> unique = new LinkedHashMap<>();
        for (CreateCardRequest request : requests) {
            unique.putIfAbsent(request.front().trim(), request);
        }

        // 2. 一次查出库里已有哪些
        Set<String> existing = cardRepository.findExistingFronts(unique.keySet());

        // 3. 分成要导入的和要跳过的
        List<Card> toSave = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (Map.Entry<String, CreateCardRequest> entry : unique.entrySet()) {
            String front = entry.getKey();
            if (existing.contains(front)) {
                skipped.add(front);
            } else {
                String back = entry.getValue().back();
                toSave.add(new Card(front, back == null ? null : back.trim(), now));
            }
        }

        cardRepository.saveAll(toSave);

        return new ImportResult(toSave.size(), skipped.size(), skipped);
    }

    @Transactional(readOnly = true)
    public Stats stats(Instant now) {
        long total = cardRepository.count();
        long due = cardRepository.countByDueAtLessThanEqual(now);
        long reviewedToday = reviewLogRepository.countByReviewedAtGreaterThanEqual(
                now.truncatedTo(ChronoUnit.DAYS));
        return new Stats(total, due, reviewedToday);
    }

    public record Stats(long totalCards, long dueToday, long reviewedToday) {
    }

    public record ImportResult(int imported, int skipped, List<String> skippedFronts) {
    }
}