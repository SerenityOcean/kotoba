package com.keshi.kotoba.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private AppUserRepository users;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = mock(AppUserRepository.class);
        // 假装数据库：存什么返回什么
        when(users.saveAndFlush(any(AppUser.class))).thenAnswer(call -> call.getArgument(0));
        authService = new AuthService(users, encoder, Clock.systemUTC());
    }

    @Test
    @DisplayName("注册新用户：用户名小写存，密码只存哈希")
    void registerHashesPassword() {
        AppUser user = authService.register("  Keshi  ", "hunter2hunter2");

        assertEquals("keshi", user.getUsername());
        assertFalse(user.getPasswordHash().contains("hunter2hunter2"));
        assertTrue(encoder.matches("hunter2hunter2", user.getPasswordHash()));
    }

    @Test
    @DisplayName("没设密码的占位账号不能再靠同名注册认领 —— 否则谁先来谁拿走")
    void registerDoesNotClaimPasswordlessAccount() {
        when(users.existsByUsername("keshi")).thenReturn(true);

        assertThrows(UsernameTakenException.class,
                () -> authService.register("keshi", "hunter2hunter2"));
    }

    @Test
    @DisplayName("GitHub 建号：从 login 推用户名，去掉非法字符，撞名加后缀，没有密码")
    void registerWithoutPasswordPicksFreeUsername() {
        when(users.existsByUsername("keshi_dev")).thenReturn(true);
        when(users.existsByUsername("keshi_dev-2")).thenReturn(true);

        AppUser user = authService.registerWithoutPassword("Keshi_Dev!");

        assertEquals("keshi_dev-3", user.getUsername());
        assertFalse(user.hasPassword());
    }

    @Test
    @DisplayName("GitHub login 全是非法字符时退回 user")
    void registerWithoutPasswordFallsBack() {
        assertEquals("user", authService.registerWithoutPassword("..").getUsername());
    }
}
