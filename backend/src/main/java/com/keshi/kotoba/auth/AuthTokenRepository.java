package com.keshi.kotoba.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    Optional<AuthToken> findByTokenHash(String tokenHash);

    /** 发新链接时把旧的都作废：邮箱里躺着的只有最新那封是能用的。 */
    @Modifying
    @Query("update AuthToken t set t.usedAt = :now "
            + "where t.userId = :userId and t.purpose = :purpose and t.usedAt is null")
    void invalidateAll(Long userId, AuthToken.Purpose purpose, Instant now);
}
