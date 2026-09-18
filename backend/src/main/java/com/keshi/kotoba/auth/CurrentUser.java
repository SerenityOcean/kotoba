package com.keshi.kotoba.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 取当前登录用户的 id。
 * SecurityContextHolder 用 ThreadLocal 存当前请求的认证信息，
 * 由 Spring Security 的过滤器在进 Controller 之前放进去。
 */
@Component
public class CurrentUser {

    private final AppUserRepository userRepository;

    public CurrentUser(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new IllegalStateException("no authenticated user");
        }
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("user not found: " + auth.getName()))
                .getId();
    }
}