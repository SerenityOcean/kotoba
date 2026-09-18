package com.keshi.kotoba.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 登录后放进 session 的身份。除了 Spring Security 要的用户名/密码哈希，
 * 多带一个 id —— 业务层认的是 id，不是用户名（用户名以后可能允许改）。
 */
public record AppUserPrincipal(Long id, String username, String passwordHash) implements UserDetails {

    public static AppUserPrincipal of(AppUser user) {
        return new AppUserPrincipal(user.getId(), user.getUsername(), user.getPasswordHash());
    }

    /** 目前没有角色概念，谁登录进来权限都一样。 */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }
}
