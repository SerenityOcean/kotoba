package com.keshi.kotoba.card;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class CardService {

    private final CardRepository cardRepository;

    public CardService(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
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
        cardRepository.deleteById(id);
    }
}