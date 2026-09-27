package com.keshi.kotoba.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Optional;

/**
 * 密码、邮箱、找回密码。会话的踢人不在这儿做 —— 要知道"当前是哪个会话"，
 * 那是 web 层的事，见 {@link AccountController}。
 *
 * 发邮件的几个方法故意不加 @Transactional：令牌那一步自己有事务，
 * 提交之后才发信，不会出现"邮件发了、令牌却回滚了"。
 */
@Service
public class AccountService {

    static final Duration EMAIL_TOKEN_TTL = Duration.ofHours(24);
    static final Duration RESET_TOKEN_TTL = Duration.ofMinutes(30);

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthTokenService tokens;
    private final AuthMailer mailer;
    private final GithubAccountService github;
    private final String baseUrl;

    public AccountService(AppUserRepository users, PasswordEncoder passwordEncoder,
                          AuthTokenService tokens, AuthMailer mailer, GithubAccountService github,
                          @Value("${app.base-url}") String baseUrl) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.mailer = mailer;
        this.github = github;
        this.baseUrl = baseUrl;
    }

    @Transactional(readOnly = true)
    public AccountResponse view(Long userId) {
        AppUser user = find(userId);
        return new AccountResponse(user.getUsername(), user.getEmail(), user.hasPassword(),
                github.linkedLogin(userId).orElse(null));
    }

    /** 没有密码的账号（GitHub 建的）第一次设密码时不用填当前密码。 */
    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        AppUser user = find(userId);
        verifyCurrentPassword(user, currentPassword);
        user.assignPassword(passwordEncoder.encode(newPassword));
    }

    /** 换绑邮箱要验当前密码：不然偷到会话的人换上自己的邮箱，再走一次找回密码，号就归他了。 */
    public void requestEmailChange(Long userId, String currentPassword, String rawEmail) {
        AppUser user = find(userId);
        verifyCurrentPassword(user, currentPassword);

        String email = AuthService.normalizeEmail(rawEmail);
        if (email.equals(user.getEmail())) {
            throw new IllegalArgumentException("已经绑定的就是这个邮箱");
        }
        ensureEmailFree(email, userId);

        String token = tokens.issue(userId, AuthToken.Purpose.VERIFY_EMAIL, email, EMAIL_TOKEN_TTL);
        mailer.send(email, "言葉 · 验证你的邮箱", """
                你好，%s：

                点下面的链接，把这个邮箱绑定到你的言葉账号（24 小时内有效）：

                %s/verify-email?token=%s

                如果不是你本人操作，忽略这封邮件就好。
                """.formatted(user.getUsername(), baseUrl, token));
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        AuthToken token = tokens.consume(rawToken, AuthToken.Purpose.VERIFY_EMAIL);
        // 发链接到点链接之间，这个邮箱可能被别人抢先验证了
        ensureEmailFree(token.getEmail(), token.getUserId());
        find(token.getUserId()).assignEmail(token.getEmail());
    }

    @Transactional
    public void removeEmail(Long userId) {
        find(userId).assignEmail(null);
    }

    /**
     * 找回密码。邮箱不存在也安安静静地返回 —— 前端统一说"如果绑定过，邮件已发出"，
     * 否则这个接口就成了"查某个邮箱在不在本站注册过"的工具。
     */
    public void requestPasswordReset(String rawEmail) {
        Optional<AppUser> user = users.findByEmail(AuthService.normalizeEmail(rawEmail));
        if (user.isEmpty()) {
            return;
        }
        AppUser u = user.get();
        String token = tokens.issue(u.getId(), AuthToken.Purpose.RESET_PASSWORD, u.getEmail(), RESET_TOKEN_TTL);
        mailer.send(u.getEmail(), "言葉 · 重置密码", """
                你好，%s：

                点下面的链接设置新密码（30 分钟内有效，只能用一次）：

                %s/reset-password?token=%s

                如果不是你本人操作，忽略这封邮件就好，密码不会被改动。
                """.formatted(u.getUsername(), baseUrl, token));
    }

    /** 重置成功返回用户名 —— 调用方要拿它把这个人所有的会话都踢掉。 */
    @Transactional
    public String resetPassword(String rawToken, String newPassword) {
        AuthToken token = tokens.consume(rawToken, AuthToken.Purpose.RESET_PASSWORD);
        AppUser user = find(token.getUserId());
        user.assignPassword(passwordEncoder.encode(newPassword));
        return user.getUsername();
    }

    private void verifyCurrentPassword(AppUser user, String currentPassword) {
        if (!user.hasPassword()) {
            return;
        }
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new WrongPasswordException();
        }
    }

    private void ensureEmailFree(String email, Long userId) {
        users.findByEmail(email)
                .filter(other -> !other.getId().equals(userId))
                .ifPresent(other -> {
                    throw new AccountConflictException("这个邮箱已经绑定了别的账号");
                });
    }

    private AppUser find(Long userId) {
        return users.findById(userId).orElseThrow();
    }
}
