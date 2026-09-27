package com.keshi.kotoba.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** 一个第三方账号绑到哪个本站用户上。 */
@Entity
@Table(name = "oauth_identity")
public class OAuthIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String provider;

    /** 对方的数字 id。认人靠它 —— login 用户自己能改。 */
    @Column(nullable = false)
    private String providerUserId;

    /** 对方的登录名，只用来在账号页上显示"已绑定 @xxx"。 */
    private String providerLogin;

    @Column(nullable = false)
    private Instant createdAt;

    protected OAuthIdentity() {
    }

    OAuthIdentity(Long userId, String provider, String providerUserId, String providerLogin,
                  Instant createdAt) {
        this.userId = userId;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.providerLogin = providerLogin;
        this.createdAt = createdAt;
    }

    void updateLogin(String providerLogin) {
        this.providerLogin = providerLogin;
    }

    public Long getUserId() {
        return userId;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public String getProviderLogin() {
        return providerLogin;
    }
}
