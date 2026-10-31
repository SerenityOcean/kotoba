package com.keshi.kotoba.folder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 阅读和应试里的「集」。文章一堆、真题一堆，各自分各自的：kind 区分是哪一类。
 * 和卡片的「包」是同一个用法，只是删掉时里面的东西不删，退回未归档。
 */
@Entity
@Table(name = "folder")
public class Folder {

    public enum Kind {
        ARTICLE("article"),
        EXAM("exam");

        private final String table;

        Kind(String table) {
            this.table = table;
        }

        /** 这一类东西存在哪张表，数各集里有几个时用。 */
        public String table() {
            return table;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private Kind kind;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(nullable = false)
    private Instant createdAt;

    protected Folder() {
    }

    public Folder(Long ownerId, Kind kind, String name, Instant createdAt) {
        this.ownerId = ownerId;
        this.kind = kind;
        this.name = name;
        this.createdAt = createdAt;
    }

    public void rename(String name) {
        this.name = name.trim();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Kind getKind() {
        return kind;
    }

    public String getName() {
        return name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
