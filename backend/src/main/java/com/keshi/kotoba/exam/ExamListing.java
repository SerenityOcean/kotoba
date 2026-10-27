package com.keshi.kotoba.exam;

import java.time.Instant;

/** 列表里的一份卷子，不带卷面。 */
public record ExamListing(Long id, String title, int questionCount, int gradedCount, Instant createdAt) {
}
