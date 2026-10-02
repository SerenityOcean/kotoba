package com.keshi.kotoba.self;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EssayServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-02T13:00:00Z");

    private EssayRepository essays;
    private EssayService essayService;

    @BeforeEach
    void setUp() {
        essays = mock(EssayRepository.class);
        when(essays.save(any(Essay.class))).thenAnswer(call -> call.getArgument(0));
        essayService = new EssayService(essays);
    }

    @Test
    @DisplayName("换行统一成 \\n，首尾空白去掉，连着的空行并成一个")
    void normalizesWhitespace() {
        Essay essay = essayService.write("  桂花开了。  \r\n\r\n\r\n\r\n秋天来了。\t\r\n", NOW);

        assertEquals("桂花开了。\n\n秋天来了。", essay.getBody());
        assertEquals(NOW, essay.getWrittenAt());
    }

    @Test
    @DisplayName("全是空白的写不进去")
    void rejectsBlank() {
        assertThrows(IllegalArgumentException.class, () -> essayService.write(" \n\t ", NOW));
    }

    @Test
    @DisplayName("超过五千字写不进去")
    void rejectsTooLong() {
        String tooLong = "字".repeat(EssayService.MAX_LENGTH + 1);
        assertThrows(IllegalArgumentException.class, () -> essayService.write(tooLong, NOW));
    }

    @Test
    @DisplayName("多取一条判断还有没有更早的，返回时把那条去掉")
    void pageDetectsMore() {
        when(essays.findByIdLessThanOrderByIdDesc(eq(50L), any(Pageable.class))).thenReturn(essaysFrom(49, 4));
        when(essays.count()).thenReturn(49L);

        EssayService.EssayPage page = essayService.page(50L, 3);

        assertEquals(3, page.essays().size());
        assertTrue(page.hasMore());
        assertEquals(49L, page.total());
    }

    @Test
    @DisplayName("取到的不满一页就是到底了")
    void lastPage() {
        when(essays.findAllByOrderByIdDesc(any(Pageable.class))).thenReturn(essaysFrom(2, 2));

        EssayService.EssayPage page = essayService.page(null, 60);

        assertEquals(2, page.essays().size());
        assertFalse(page.hasMore());
    }

    @Test
    @DisplayName("改过的随笔落笔时刻不变，记下改的时刻")
    void reviseKeepsWrittenAt() {
        Instant written = NOW.minusSeconds(86_400);
        Essay essay = new Essay("雨。", written);
        when(essays.findById(7L)).thenReturn(java.util.Optional.of(essay));

        essayService.revise(7L, "雨，很大。", NOW);

        assertEquals("雨，很大。", essay.getBody());
        assertEquals(written, essay.getWrittenAt());
        assertEquals(NOW, essay.getEditedAt());
    }

    private static List<Essay> essaysFrom(long newestId, int count) {
        return LongStream.range(0, count)
                .mapToObj(i -> new Essay("第 " + (newestId - i) + " 条", NOW))
                .toList();
    }
}
