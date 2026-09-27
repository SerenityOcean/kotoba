package com.keshi.kotoba.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /**
     * 用户名统一小写存、小写查，免得 keshi / Keshi 变成两个账号。
     * 登录和注册都要过这一道，否则注册进去的登不回来。
     */
    public static String normalize(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 注册。同名一律 409 —— 包括没设密码的账号（V2 的占位行、GitHub 建的号）。
     * 以前这里允许"同名注册即认领"占位账号，那等于谁先来谁拿走那些卡片，已经去掉；
     * 占位账号要设密码，走 deploy/README.md 里的手动步骤。
     */
    @Transactional
    public AppUser register(String rawUsername, String rawPassword) {
        String username = normalize(rawUsername);
        if (users.existsByUsername(username)) {
            throw new UsernameTakenException(username);
        }
        try {
            return users.saveAndFlush(
                    new AppUser(username, passwordEncoder.encode(rawPassword), Instant.now(clock)));
        } catch (DataIntegrityViolationException e) {
            // 同名并发注册，唯一约束兜住了
            throw new UsernameTakenException(username);
        }
    }

    /**
     * 第三方登录第一次进来时建号：没有密码，用户名从对方的登录名推出来，
     * 撞名了就加后缀。推不出合法用户名（比如全是符号）就退回 "user"。
     */
    @Transactional
    public AppUser registerWithoutPassword(String suggestedUsername) {
        String base = normalize(suggestedUsername).replaceAll("[^a-z0-9_-]", "");
        if (base.length() < 2) {
            base = "user";
        }
        base = base.substring(0, Math.min(base.length(), 28));

        String username = base;
        for (int i = 2; users.existsByUsername(username); i++) {
            username = base + "-" + i;
        }
        return users.saveAndFlush(new AppUser(username, AppUser.NO_PASSWORD, Instant.now(clock)));
    }
}
