package com.keshi.kotoba.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * 一次性令牌。原文 32 字节随机数，只出现在发出去的那封邮件里；库里存 SHA-256。
 * 用 SHA-256 而不是 bcrypt：令牌本身熵够高，没有被字典爆破的可能，慢哈希只会拖慢查询。
 */
@Service
public class AuthTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthTokenRepository tokens;
    private final Clock clock;

    public AuthTokenService(AuthTokenRepository tokens, Clock clock) {
        this.tokens = tokens;
        this.clock = clock;
    }

    /** 发一个新令牌，同一用途的旧令牌全部作废。返回原文，调用方拼进链接里发出去。 */
    @Transactional
    public String issue(Long userId, AuthToken.Purpose purpose, String email, Duration ttl) {
        Instant now = Instant.now(clock);
        tokens.invalidateAll(userId, purpose, now);

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        tokens.save(new AuthToken(userId, purpose, hash(raw), email, now.plus(ttl), now));
        return raw;
    }

    /** 核销：校验通过就标记为已用，同一个链接点第二次就不灵了。 */
    @Transactional
    public AuthToken consume(String raw, AuthToken.Purpose purpose) {
        Instant now = Instant.now(clock);
        AuthToken token = tokens.findByTokenHash(hash(raw))
                .filter(t -> t.getPurpose() == purpose && t.usableAt(now))
                .orElseThrow(InvalidTokenException::new);
        token.markUsed(now);
        return token;
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
