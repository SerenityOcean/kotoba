package com.keshi.kotoba.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OAuthIdentityRepository extends JpaRepository<OAuthIdentity, Long> {

    Optional<OAuthIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);

    Optional<OAuthIdentity> findByUserIdAndProvider(Long userId, String provider);
}
