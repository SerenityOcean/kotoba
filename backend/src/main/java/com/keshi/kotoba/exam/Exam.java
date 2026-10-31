package com.keshi.kotoba.exam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 导入的一份读解真题。卷面整份是一个 JSON（{@link ExamContent}），
 * 注音在前端做完才提交，这边只管存和判分。
 *
 * <p>题数单拎出来存一份：列表要显示，不该为了数题把整份卷子读出来解析。
 */
@Entity
@Table(name = "exam")
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private int questionCount;

    @Column(nullable = false)
    private int gradedCount;

    @Column(nullable = false)
    private Instant createdAt;

    /** 所在的集，空就是未归档。 */
    private Long folderId;

    protected Exam() {
    }

    public Exam(Long ownerId, String title, String content, int questionCount, int gradedCount,
                Instant createdAt, Long folderId) {
        this.ownerId = ownerId;
        this.folderId = folderId;
        this.title = title.trim();
        this.content = content;
        this.questionCount = questionCount;
        this.gradedCount = gradedCount;
        this.createdAt = createdAt;
    }

    public void moveTo(Long folderId) {
        this.folderId = folderId;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public int getGradedCount() {
        return gradedCount;
    }

    public Long getFolderId() {
        return folderId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
