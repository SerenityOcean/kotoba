package com.keshi.kotoba;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class PingMessage {

    @Id
    private Long id;

    private String text;

    protected PingMessage() {
    }

    public Long getId() {
        return id;
    }

    public String getText() {
        return text;
    }
}