package com.keshi.kotoba.card;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import  java.time.temporal.ChronoUnit;
import java.time.Instant;
import java.util.List;

@Service
public class CardService {


    private final CardRepository cardRepository;
    private final ReviewLogRepository reviewLogRepository;


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


    public CardService(CardRepository cardRepository, ReviewLogRepository reviewLogRepository) {
        this.cardRepository = cardRepository;
        this.reviewLogRepository = reviewLogRepository;
    }

}