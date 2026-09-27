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
     * "这个账号没有密码"。不是合法的 bcrypt 串，所以任何密码都匹配不上。
     * 两种来源：V2 迁移给 keshi 插的占位行，以及用 GitHub 登录自动建的账号。
     * 这种账号要么走第三方登录，要么在账号页里先设一个密码。
     */
    public static final String NO_PASSWORD = "NOT_SET";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    /** 验证过的邮箱，小写。没绑就是 null。 */
    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private Instant createdAt;

    protected AppUser() {
    }

    public AppUser(String username, String passwordHash, Instant createdAt) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
    }

    public boolean hasPassword() {
        return !NO_PASSWORD.equals(passwordHash);
    }

    /** 传进来的必须已经是 encode 过的。 */
    void assignPassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    void assignEmail(String email) {
        this.email = email;
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

    public String getEmail() {
        return email;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
