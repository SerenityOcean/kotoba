package com.keshi.kotoba;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class PingController {

    private final PingMessageRepository repository;

    public PingController(PingMessageRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/api/ping")
    public Map<String, String> ping() {
        String text = repository.findById(1L)
                .map(PingMessage::getText)
                .orElse("数据库里没查到");
        return Map.of("message", text);
    }
}