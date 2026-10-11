package com.keshi.kotoba.card;

import com.keshi.kotoba.deck.Deck;
import com.keshi.kotoba.deck.DeckService;
import com.keshi.kotoba.web.Zones;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
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
    private final StudyPlan studyPlan;

    /** 补读音一批最多这么多张。查词典很快，限这个数是为了前端能边翻边显示进度。 */
    static final int MAX_FILL_BATCH = 50;

    public CardService(CardRepository cardRepository,
                       UserCardStateRepository stateRepository,
                       ReviewLogRepository reviewLogRepository,
                       DeckService deckService,
                       StudyPlan studyPlan) {
        this.cardRepository = cardRepository;
        this.stateRepository = stateRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.deckService = deckService;
        this.studyPlan = studyPlan;
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

    /**
     * 这一轮要复习的卡：到期的旧卡全部，加上今天还能放出的新卡。
     * 旧卡在前（按到期时间），新卡在后（按建卡先后）—— 先还旧账再学新的。
     *
     * @param extraNew 「再来几张」额外要的新卡数
     */
    @Transactional(readOnly = true)
    public List<CardWithState> findDue(Long userId, Long deckId, Instant now, ZoneId zone, int extraNew) {
        // 先查状态表（排序条件在这边），再按 id 捞回卡片内容
        List<UserCardState> dueStates = deckId == null
                ? stateRepository.findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(userId, now)
                : stateRepository.findDueByDeck(userId, deckService.get(userId, deckId).getId(), now);

        long allowance = studyPlan.newAllowance(userId, now, zone, extraNew);
        List<UserCardState> chosen = new ArrayList<>(dueStates.stream().filter(s -> !s.isNew()).toList());
        dueStates.stream().filter(UserCardState::isNew).limit(allowance).forEach(chosen::add);

        List<Long> cardIds = chosen.stream().map(UserCardState::getCardId).toList();
        Map<Long, Card> byId = cardRepository.findAllById(cardIds).stream()
                .collect(Collectors.toMap(Card::getId, Function.identity()));

        // 遍历 chosen 而不是 byId，保住上面排好的顺序
        return chosen.stream()
                .map(st -> new CardWithState(byId.get(st.getCardId()), st))
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
     * 给还没读音的卡补读音，一次一批：afterId 之后的最多 limit 张。卡片页「补读音」用，
     * 前端拿 nextAfterId 接着翻，直到翻完。
     */
    public ReadingFill fillReadings(Long userId, Long afterId, int limit) {
        int size = Math.clamp(limit, 1, MAX_FILL_BATCH);
        List<Card> batch = cardRepository.findByOwnerIdAndReadingIsNullAndIdGreaterThanOrderByIdAsc(
                userId, afterId == null ? 0L : afterId, PageRequest.of(0, size));

        FillOutcome outcome = fill(batch);
        Long lastId = batch.size() < size ? null : batch.getLast().getId();
        return new ReadingFill(outcome.filled(), outcome.missed(), lastId);
    }

    /**
     * 只给指定的几张卡补读音 —— 复习页开场时给到期的卡补，不用先去卡片页点按钮。
     * 不是自己的、已经有读音的直接跳过。返回补上的那些卡的读音。
     */
    public CardReadings fillReadingsFor(Long userId, List<Long> cardIds) {
        List<Card> batch = cardRepository.findAllById(cardIds.stream().limit(MAX_FILL_BATCH).toList())
                .stream()
                .filter(c -> c.getOwnerId().equals(userId) && c.getReading() == null)
                .toList();

        fill(batch);
        return new CardReadings(batch.stream()
                .filter(c -> c.getReading() != null)
                .map(c -> new CardReading(c.getId(), c.getReading()))
                .toList());
    }

    /** 补一批：卡片自己带的读音优先，没有再查词典（见 {@link Readings#guess}）。 */
    private FillOutcome fill(List<Card> batch) {
        int filled = 0;
        int missed = 0;
        for (Card card : batch) {
            if (!Readings.wanted(card.getFront())) {
                continue;
            }
            String reading = Readings.guess(card.getFront(), card.getBack());
            if (reading != null) {
                card.fillReading(reading);
                filled++;
            } else {
                missed++;
            }
        }
        cardRepository.saveAll(batch.stream().filter(c -> c.getReading() != null).toList());
        return new FillOutcome(filled, missed);
    }

    private record FillOutcome(int filled, int missed) {
    }

    /**
     * 一批补读音的结果。
     *
     * @param missed      该有读音但没补上的张数（词典里查不到的词）
     * @param nextAfterId 下一批从哪儿接着翻；null 表示翻完了
     */
    public record ReadingFill(int filled, int missed, Long nextAfterId) {
    }

    public record CardReading(Long id, String reading) {
    }

    /** 指定卡片补读音的结果：补上了的卡和它们的读音。 */
    public record CardReadings(List<CardReading> readings) {
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
    public Map<Long, DeckCounts> countsByDeck(Long userId, Instant now, ZoneId zone) {
        Map<Long, DeckCounts> result = new HashMap<>();

        for (DeckCount row : cardRepository.countByDeck(userId)) {
            result.put(row.getDeckId(), new DeckCounts(row.getCount(), 0));
        }
        // 到期数 = 到期的旧卡 + 这个包里的新卡（最多放到今天的名额）—— 和点进去复习时看到的一样多
        long allowance = studyPlan.newAllowance(userId, now, zone, 0);
        Map<Long, Long> newDue = new HashMap<>();
        for (DeckCount row : stateRepository.countDueNewByDeck(userId, now)) {
            newDue.put(row.getDeckId(), row.getCount());
        }
        for (DeckCount row : stateRepository.countDueByDeck(userId, now)) {
            long fresh = newDue.getOrDefault(row.getDeckId(), 0L);
            long due = row.getCount() - fresh + Math.min(fresh, allowance);
            DeckCounts current = result.getOrDefault(row.getDeckId(), new DeckCounts(0, 0));
            result.put(row.getDeckId(), new DeckCounts(current.cards(), due));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Stats stats(Long userId, Instant now, ZoneId zone) {
        long total = cardRepository.countByOwnerId(userId);
        long dueAll = stateRepository.countByUserIdAndDueAtLessThanEqual(userId, now);
        long newWaiting = stateRepository.countDueNew(userId, now);
        long newToday = Math.min(newWaiting, studyPlan.newAllowance(userId, now, zone, 0));
        long dueReviews = dueAll - newWaiting;
        long reviewedToday = reviewLogRepository.countByUserIdAndReviewedAtGreaterThanEqual(
                userId, Zones.startOfDay(now, zone));
        return new Stats(total, dueReviews + newToday, reviewedToday,
                dueReviews, newToday, newWaiting,
                studyPlan.learnedToday(userId, now, zone), studyPlan.dailyNewLimit(userId));
    }

    /** 卡片内容 + 当前用户在它上面的进度。HTTP 层要把两者拼成一个响应。 */
    public record CardWithState(Card card, UserCardState state) {
    }

    /**
     * @param dueToday      这一轮要复习的总数 = dueReviews + newToday
     * @param dueReviews    到期的旧卡
     * @param newToday      今天还能放出的新卡
     * @param newWaiting    所有还没学过的卡（等着被放出来的）
     * @param learnedToday  今天已经学了几张新卡
     * @param dailyNewLimit 每天新卡上限，null = 不限
     */
    public record Stats(long totalCards, long dueToday, long reviewedToday,
                        long dueReviews, long newToday, long newWaiting,
                        long learnedToday, Integer dailyNewLimit) {
    }

    public record DeckCounts(long cards, long due) {
    }

    public record ImportResult(Long deckId, String deckName,
                               int imported, int skipped, List<String> skippedFronts) {
    }
}
