package com.keshi.kotoba.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

    /**
     * V2 迁移给 keshi 插的占位密码。不是合法的 bcrypt 串，所以任何密码都匹配不上；
     * 用同名走一次注册即可"认领"这个账号（见 {@link AuthService#register}）。
     */
    public static final String PLACEHOLDER_PASSWORD_HASH = "NOT_SET";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private Instant createdAt;

    protected AppUser() {
    }

    public AppUser(String username, String passwordHash, Instant createdAt) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
    }

    public boolean hasPlaceholderPassword() {
        return PLACEHOLDER_PASSWORD_HASH.equals(passwordHash);
    }

    /** 认领占位账号时把 NOT_SET 换成真哈希。传进来的必须已经是 encode 过的。 */
    void assignPassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}