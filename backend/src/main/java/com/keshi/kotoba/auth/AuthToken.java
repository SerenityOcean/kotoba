package com.keshi.kotoba.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** 邮件里那种一次性链接背后的记录。见 {@link AuthTokenService}。 */
@Entity
@Table(name = "auth_token")
public class AuthToken {

    public enum Purpose {
        /** 绑定/更换邮箱：点了链接才把 {@link #email} 写到 app_user 上。 */
        VERIFY_EMAIL,
        RESET_PASSWORD
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Purpose purpose;

    @Column(nullable = false, unique = true)
    private String tokenHash;

    private String email;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;

    @Column(nullable = false)
    private Instant createdAt;

    protected AuthToken() {
    }

    AuthToken(Long userId, Purpose purpose, String tokenHash, String email,
              Instant expiresAt, Instant createdAt) {
        this.userId = userId;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.email = email;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    boolean usableAt(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }

    void markUsed(Instant now) {
        this.usedAt = now;
    }

    public Long getUserId() {
        return userId;
    }

    public Purpose getPurpose() {
        return purpose;
    }

    public String getEmail() {
        return email;
    }
}
