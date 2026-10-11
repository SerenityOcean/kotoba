package com.keshi.kotoba.card;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 太长的正面以前会撞上数据库唯一索引的大小上限，回 500。现在入口就挡住，回 400 和原因。 */
class CardRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private Set<String> messages(Object request) {
        return validator.validate(request).stream()
                .map(ConstraintViolation::getMessage)
                .collect(java.util.stream.Collectors.toSet());
    }

    @Test
    @DisplayName("正面、背面在上限以内的照收")
    void acceptsWithinLimits() {
        assertTrue(messages(new CreateCardRequest("あ".repeat(500), "い".repeat(5000))).isEmpty());
        assertTrue(messages(new CreateCardRequest("勉強", null)).isEmpty());
    }

    @Test
    @DisplayName("正面超过 500 字、背面超过 5000 字的拒掉")
    void rejectsOversized() {
        assertEquals(Set.of("正面最长 500 字"), messages(new CreateCardRequest("あ".repeat(501), "")));
        assertEquals(Set.of("背面最长 5000 字"), messages(new CreateCardRequest("勉強", "い".repeat(5001))));
        assertEquals(Set.of("正面最长 500 字"),
                messages(new UpdateCardRequest("あ".repeat(501), "", null)));
    }

    @Test
    @DisplayName("导入时每一张都校验")
    void validatesEachImportedCard() {
        ImportRequest request = new ImportRequest(
                java.util.List.of(new CreateCardRequest("勉強", ""), new CreateCardRequest("あ".repeat(501), "")),
                null);
        assertEquals(Set.of("正面最长 500 字"), messages(request));
    }
}
