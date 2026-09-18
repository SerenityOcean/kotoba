package com.keshi.kotoba.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 用户名统一小写存、小写查，免得 keshi / Keshi 变成两个账号。
     * 登录和注册都要过这一道，否则注册进去的登不回来。
     */
    public static String normalize(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 注册。有一个特例：V2 迁移插的占位账号（password_hash = 'NOT_SET'）可以被"认领" ——
     * 用同名注册就是给它设上真密码，卡片还是原来那些。
     * 认领过一次之后它就是普通账号了，再注册同名就是 409。
     */
    @Transactional
    public AppUser register(String rawUsername, String rawPassword) {
        String username = normalize(rawUsername);
        String hash = passwordEncoder.encode(rawPassword);

        Optional<AppUser> existing = users.findByUsername(username);
        if (existing.isPresent()) {
            AppUser user = existing.get();
            if (!user.hasPlaceholderPassword()) {
                throw new UsernameTakenException(username);
            }
            user.assignPassword(hash);
            return users.save(user);
        }

        try {
            return users.save(new AppUser(username, hash, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // 同名并发注册，唯一约束兜住了
            throw new UsernameTakenException(username);
        }
    }
}
