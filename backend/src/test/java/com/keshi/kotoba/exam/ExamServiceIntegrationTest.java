package com.keshi.kotoba.exam;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 卷面整份进出 JSON、交卷记录跟着卷子删，这些要连真库（先 docker compose up）。 */
@SpringBootTest
class ExamServiceIntegrationTest {

    @Autowired
    private ExamService examService;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<Long> createdUsers = new ArrayList<>();
    private long userId;

    @BeforeEach
    void setUp() {
        userId = createUser();
    }

    @AfterEach
    void cleanUp() {
        for (long id : createdUsers) {
            jdbc.update("DELETE FROM exam WHERE owner_id = ?", id);
            jdbc.update("DELETE FROM app_user WHERE id = ?", id);
        }
    }

    @Test
    @DisplayName("卷面原样存进去、原样取出来，题数和计分题数算好")
    void roundTripsContent() {
        ExamResponse created = examService.create(userId, "  2015年7月  ", content());

        ExamResponse found = examService.find(userId, created.id());
        assertEquals("2015年7月", found.title());
        assertEquals(content(), found.content());
        assertEquals(3, found.questionCount());
        assertEquals(2, found.gradedCount());
        assertEquals(List.of(), found.attempts());
    }

    @Test
    @DisplayName("交卷按存下的答案判分；列表带上次数和最近一次")
    void submitsAndLists() {
        long id = examService.create(userId, "卷子", content()).id();

        examService.submit(userId, id, Map.of(55, 3), 600);
        AttemptResponse second = examService.submit(userId, id, Map.of(55, 3, 56, 4, 57, 1), 1200);
        assertEquals(2, second.correct());
        assertEquals(2, second.graded());

        ExamSummary summary = examService.list(userId).getFirst();
        assertEquals(2, summary.attemptCount());
        assertEquals(second.id(), summary.lastAttempt().id());
        assertEquals(Map.of(55, 3, 56, 4, 57, 1), summary.lastAttempt().answers());

        List<AttemptResponse> attempts = examService.find(userId, id).attempts();
        assertEquals(2, attempts.size());
        assertEquals(second.id(), attempts.getFirst().id());
    }

    @Test
    @DisplayName("没做过的卷子，最近一次是 null")
    void listsUntouchedExam() {
        examService.create(userId, "卷子", content());

        ExamSummary summary = examService.list(userId).getFirst();
        assertEquals(0, summary.attemptCount());
        assertNull(summary.lastAttempt());
    }

    @Test
    @DisplayName("题号重复的卷子不收")
    void rejectsDuplicateNumbers() {
        ExamContent duplicated = new ExamContent(List.of(), List.of(new ExamContent.Section("", "", List.of(
                new ExamContent.Passage("", List.of(), List.of(question(55, 1), question(55, 2)))))));

        assertThrows(InvalidExamException.class, () -> examService.create(userId, "卷子", duplicated));
    }

    @Test
    @DisplayName("别人的卷子看不到、交不了、删不掉；删卷子连交卷记录一起删")
    void scopedToOwner() {
        long id = examService.create(userId, "卷子", content()).id();
        examService.submit(userId, id, Map.of(55, 3), 60);
        long other = createUser();

        assertThrows(ExamNotFoundException.class, () -> examService.find(other, id));
        assertThrows(ExamNotFoundException.class, () -> examService.submit(other, id, Map.of(), 0));
        assertThrows(ExamNotFoundException.class, () -> examService.delete(other, id));
        assertEquals(List.of(), examService.list(other));

        examService.delete(userId, id);
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM exam_attempt WHERE exam_id = ?", Integer.class, id));
    }

    private static ExamContent content() {
        return new ExamContent(List.of("来源：讲义"), List.of(new ExamContent.Section("問題10", "短篇阅读", List.of(
                new ExamContent.Passage("本文（1）", List.of(
                        new ExamContent.Block("text", "⟦そんな楽器[がっき]⟧がそろった", null),
                        new ExamContent.Block("note", "誤用[ごよう]：間違[まちが]った使[つか]い方[かた]", "注")),
                        List.of(question(55, 3), question(56, 4), question(57, null)))))));
    }

    private static ExamContent.Question question(int number, Integer answer) {
        return new ExamContent.Question(number, "⟦そんな楽器⟧とは、どのようなものか。", List.of(),
                List.of("一", "二", "三", "四"), answer);
    }

    private long createUser() {
        String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        long id = jdbc.queryForObject(
                "INSERT INTO app_user (username, password_hash) VALUES (?, 'x') RETURNING id",
                Long.class, username);
        createdUsers.add(id);
        return id;
    }
}
