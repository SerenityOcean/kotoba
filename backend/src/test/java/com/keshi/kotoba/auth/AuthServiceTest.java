package com.keshi.kotoba.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Optional;

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
        when(users.save(any(AppUser.class))).thenAnswer(call -> call.getArgument(0));
        authService = new AuthService(users, encoder);
    }

    @Test
    @DisplayName("注册新用户：用户名小写存，密码只存哈希")
    void registerHashesPassword() {
        when(users.findByUsername("keshi")).thenReturn(Optional.empty());

        AppUser user = authService.register("  Keshi  ", "hunter2hunter2");

        assertEquals("keshi", user.getUsername());
        assertFalse(user.getPasswordHash().contains("hunter2hunter2"));
        assertTrue(encoder.matches("hunter2hunter2", user.getPasswordHash()));
    }

    @Test
    @DisplayName("占位账号能被同名注册认领，还是同一行（卡片跟着留下）")
    void registerClaimsPlaceholderAccount() {
        AppUser placeholder = withId(1L,
                new AppUser("keshi", AppUser.PLACEHOLDER_PASSWORD_HASH, Instant.now()));
        when(users.findByUsername("keshi")).thenReturn(Optional.of(placeholder));

        AppUser claimed = authService.register("keshi", "hunter2hunter2");

        assertEquals(1L, claimed.getId());
        assertFalse(claimed.hasPlaceholderPassword());
        assertTrue(encoder.matches("hunter2hunter2", claimed.getPasswordHash()));
    }

    @Test
    @DisplayName("已经有真密码的账号，同名注册直接冲突")
    void registerRejectsTakenUsername() {
        AppUser existing = withId(1L,
                new AppUser("keshi", encoder.encode("hunter2hunter2"), Instant.now()));
        when(users.findByUsername("keshi")).thenReturn(Optional.of(existing));

        assertThrows(UsernameTakenException.class,
                () -> authService.register("keshi", "another-password"));
    }

    /** id 由数据库生成，测试里只好反射塞一个。 */
    private static AppUser withId(Long id, AppUser user) {
        try {
            Field field = AppUser.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
            return user;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
