package com.keshi.kotoba.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsername(String username);

    boolean existsByUsername(String username);

    /** 传进来前先 {@link AuthService#normalizeEmail} 过一道，库里存的都是小写。 */
    Optional<AppUser> findByEmail(String email);
}
