package com.keshi.kotoba.card;

import com.keshi.kotoba.analyze.AnalysisFailedException;
import com.keshi.kotoba.analyze.AnalysisUnavailableException;
import com.keshi.kotoba.analyze.FuriganaResult;
import com.keshi.kotoba.analyze.FuriganaService;
import com.keshi.kotoba.deck.Deck;
import com.keshi.kotoba.deck.DeckService;
import com.keshi.kotoba.text.FuriganaNotation;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
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
    private final FuriganaService furiganaService;

    /** 补读音一批最多这么多张。一批问一次模型，几十个短词几秒钟就回来。 */
    static final int MAX_FILL_BATCH = 50;

    public CardService(CardRepository cardRepository,
                       UserCardStateRepository stateRepository,
                       ReviewLogRepository reviewLogRepository,
                       DeckService deckService,
                       FuriganaService furiganaService) {
        this.cardRepository = cardRepository;
        this.stateRepository = stateRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.deckService = deckService;
        this.furiganaService = furiganaService;
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
    public CardWithState update(Long userId, Long id, String front, String back, String reading) {
        Card card = cardRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new CardNotFoundException(id));
        card.updateContent(front, back, reading);
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

    /**
     * 给还没读音的卡补读音，一次一批：afterId 之后的最多 limit 张。
     *
     * <p>先用确定的规则（正面注音、背面开头的假名），规则猜不出来的
     * 攒成一批问一次模型。不开事务：等模型的几秒里不该占着数据库连接，
     * 存的时候 saveAll 自己有事务。
     *
     * <p>模型不可用或者这批失败了，规则那部分照样存，失败原因放在结果里 ——
     * 前端可以接着往后翻，不至于卡在一批上。
     */
    public ReadingFill fillReadings(Long userId, Long afterId, int limit) {
        int size = Math.clamp(limit, 1, MAX_FILL_BATCH);
        List<Card> batch = cardRepository.findByOwnerIdAndReadingIsNullAndIdGreaterThanOrderByIdAsc(
                userId, afterId == null ? 0L : afterId, PageRequest.of(0, size));

        int byRule = 0;
        Map<String, List<Card>> forModel = new LinkedHashMap<>();
        for (Card card : batch) {
            if (!Readings.wanted(card.getFront())) {
                continue;
            }
            String guessed = Readings.guess(card.getFront(), card.getBack());
            if (guessed != null) {
                card.fillReading(guessed);
                byRule++;
            } else {
                forModel.computeIfAbsent(FuriganaNotation.strip(card.getFront()).strip(),
                        k -> new ArrayList<>()).add(card);
            }
        }

        int byModel = 0;
        String modelError = null;
        if (!forModel.isEmpty()) {
            try {
                Map<String, String> readings = readingsFromModel(forModel.keySet());
                for (Map.Entry<String, String> found : readings.entrySet()) {
                    for (Card card : forModel.get(found.getKey())) {
                        card.fillReading(found.getValue());
                        byModel++;
                    }
                }
            } catch (AnalysisUnavailableException | AnalysisFailedException e) {
                modelError = e.getMessage();
            }
        }

        cardRepository.saveAll(batch.stream().filter(c -> c.getReading() != null).toList());

        int filled = byRule + byModel;
        int asked = (int) batch.stream().filter(c -> Readings.wanted(c.getFront())).count();
        Long lastId = batch.size() < size ? null : batch.getLast().getId();
        return new ReadingFill(byRule, byModel, asked - filled, lastId, modelError);
    }

    /**
     * 一行一个词交给注音服务，回来按行拆开。注音服务自己会校验模型没改字；
     * 这里再逐行核对一遍，行数对不上或者某行对不上底字的就不要了。
     */
    private Map<String, String> readingsFromModel(Collection<String> plainFronts) {
        List<String> words = List.copyOf(plainFronts);
        FuriganaResult result = furiganaService.annotate(String.join("\n", words));

        Map<String, String> readings = new HashMap<>();
        // 空行不算：模型有时在词和词之间多空一行
        List<String> lines = result.text().lines().map(String::strip).filter(l -> !l.isEmpty()).toList();
        if (!result.annotated() || lines.size() != words.size()) {
            return readings;
        }
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            String word = words.get(i);
            String reading = Readings.fromAnnotated(line);
            if (FuriganaNotation.strip(line).equals(word)
                    && reading != null && Readings.fits(word, reading)) {
                readings.put(word, reading);
            }
        }
        return readings;
    }

    /**
     * 一批补读音的结果。
     *
     * @param missed     该有读音但这批没补上的张数
     * @param nextAfterId 下一批从哪儿接着翻；null 表示翻完了
     * @param modelError 模型那一步失败的原因，没问模型或者成功了是 null
     */
    public record ReadingFill(int byRule, int byModel, int missed, Long nextAfterId, String modelError) {
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
