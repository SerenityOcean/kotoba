package com.keshi.kotoba.self;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * self 上的一条随笔。纯文本，换行就是分段。
 *
 * <p>落笔时刻写下就不再变：改过的随笔还排在原来那天，只是多一个 editedAt。
 */
@Entity
@Table(name = "essay")
public class Essay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private Instant writtenAt;

    private Instant editedAt;

    protected Essay() {
    }

    public Essay(String body, Instant writtenAt) {
        this.body = body;
        this.writtenAt = writtenAt;
    }

    public void revise(String body, Instant now) {
        this.body = body;
        this.editedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getBody() {
        return body;
    }

    public Instant getWrittenAt() {
        return writtenAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }
}
