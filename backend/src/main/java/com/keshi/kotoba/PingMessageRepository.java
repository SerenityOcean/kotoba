package com.keshi.kotoba;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PingMessageRepository extends JpaRepository<PingMessage, Long> {
}