package com.keshi.kotoba.card;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 卡片自带的录音：导入 Anki 牌组时传上来，复习时放。
 *
 * <p>录音存在数据库里，跟着卡片走：删卡就没了，备份数据库就一起备份了。
 * 一段单词录音几 KB 到几十 KB，一个两千张的牌组带例句也就几十 MB。
 */
@Service
public class CardAudioService {

    /** 一段录音最大 1 MB。正常的单词、例句录音都是几十 KB，再大多半是整段听力。 */
    static final int MAX_BYTES = 1024 * 1024;

    /**
     * 认的格式。Anki 牌组里基本是 mp3，偶尔有 ogg、m4a、wav。
     * 只收音频类型，回放时也原样用这个类型回 —— 不会被浏览器当成网页打开。
     */
    static final Set<String> TYPES = Set.of(
            "audio/mpeg", "audio/ogg", "audio/mp4", "audio/aac",
            "audio/wav", "audio/webm", "audio/flac");

    private final CardRepository cardRepository;
    private final CardAudioRepository audioRepository;
    private final long quotaBytes;

    public CardAudioService(CardRepository cardRepository,
                            CardAudioRepository audioRepository,
                            @Value("${card.audio.quota-mb:300}") long quotaMb) {
        this.cardRepository = cardRepository;
        this.audioRepository = audioRepository;
        this.quotaBytes = quotaMb * 1024 * 1024;
    }

    /** 一段要存的录音。 */
    public record Upload(Long cardId, AudioKind kind, String contentType, byte[] data) {
    }

    /**
     * 存一批录音，同一张卡同一种已经有了就换掉。只能存到自己的卡上。
     * 一批里有一段不合格就整批不存，回一句为什么。
     *
     * @return 存了几段
     */
    @Transactional
    public int store(Long userId, List<Upload> uploads, Instant now) {
        Map<Long, Card> cards = cardRepository
                .findAllById(uploads.stream().map(Upload::cardId).distinct().toList())
                .stream()
                .filter(c -> c.getOwnerId().equals(userId))
                .collect(Collectors.toMap(Card::getId, Function.identity()));

        for (Upload upload : uploads) {
            if (!cards.containsKey(upload.cardId())) {
                throw new CardNotFoundException(upload.cardId());
            }
            if (!TYPES.contains(normalizeType(upload.contentType()))) {
                throw new IllegalArgumentException("不认识的录音格式：" + upload.contentType());
            }
            if (upload.data().length == 0 || upload.data().length > MAX_BYTES) {
                throw new IllegalArgumentException("录音要在 1 MB 以内");
            }
        }

        // 先删掉要换的那几段再算用量，重新导入同一个牌组不会被算成两份
        uploads.forEach(u -> audioRepository.remove(u.cardId(), u.kind()));
        long incoming = uploads.stream().mapToLong(u -> u.data().length).sum();
        if (audioRepository.totalBytes(userId) + incoming > quotaBytes) {
            throw new AudioQuotaExceededException(quotaBytes / 1024 / 1024);
        }

        for (Upload upload : uploads) {
            audioRepository.save(new CardAudio(
                    upload.cardId(), upload.kind(), normalizeType(upload.contentType()), upload.data(), now));
            cards.get(upload.cardId()).markAudio(upload.kind());
        }
        cardRepository.saveAll(cards.values());
        return uploads.size();
    }

    /** 取一段录音来放。不是自己的卡、或者这张卡没有这段，都当没有。 */
    @Transactional(readOnly = true)
    public CardAudio load(Long userId, Long cardId, AudioKind kind) {
        cardRepository.findByIdAndOwnerId(cardId, userId)
                .orElseThrow(() -> new CardNotFoundException(cardId));
        return audioRepository.findByCardIdAndKind(cardId, kind)
                .orElseThrow(() -> new CardNotFoundException(cardId));
    }

    /** 去掉 ;codecs=… 之类的参数，统一小写。 */
    private static String normalizeType(String contentType) {
        if (contentType == null) {
            return "";
        }
        int semicolon = contentType.indexOf(';');
        String type = semicolon < 0 ? contentType : contentType.substring(0, semicolon);
        return type.trim().toLowerCase(Locale.ROOT);
    }
}
