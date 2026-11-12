package com.keshi.kotoba.exam;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HighlightRequestTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    private static boolean valid(String anchor, HighlightRange... ranges) {
        return VALIDATOR.validate(new HighlightRequest(Map.of(anchor, List.of(ranges)))).isEmpty();
    }

    @Test
    @DisplayName("段名只收小写字母、数字和点；位置要一前一后；颜色只有 1–4；空列表是去掉这段的涂色")
    void validates() {
        assertTrue(valid("q.55.c.2", new HighlightRange(0, 3, "省略し", 1), new HighlightRange(5, 6, "も", 4)));
        assertFalse(valid("q.55.c.2", new HighlightRange(0, 3, "省略し", 0)));
        assertFalse(valid("q.55.c.2", new HighlightRange(0, 3, "省略し", 5)));
        assertTrue(valid("x.55.reason"));
        assertFalse(valid("q 55", new HighlightRange(0, 3, "省略し", 1)));
        assertFalse(valid("<script>", new HighlightRange(0, 3, "省略し", 1)));
        assertFalse(valid("q.55.s", new HighlightRange(3, 3, "省", 1)));
        assertFalse(valid("q.55.s", new HighlightRange(5, 3, "省", 1)));
        assertFalse(valid("q.55.s", new HighlightRange(-1, 3, "省", 1)));
        assertFalse(valid("q.55.s", new HighlightRange(0, 3, "", 1)));
        assertFalse(VALIDATOR.validate(new HighlightRequest(Map.of())).isEmpty());
    }

    @Test
    @DisplayName("存成 JSON 只有 start、end、text、color 四项")
    void serializesPlainly() {
        JsonMapper json = JsonMapper.builder().build();
        String written = json.writeValueAsString(new HighlightRange(2, 4, "楽器", 3));
        assertEquals("{\"start\":2,\"end\":4,\"text\":\"楽器\",\"color\":3}", written);
        assertEquals(new HighlightRange(2, 4, "楽器", 3), json.readValue(written, HighlightRange.class));
    }
}
