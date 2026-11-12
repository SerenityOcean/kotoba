package com.keshi.kotoba.exam;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import com.keshi.kotoba.analyze.AnalyzeQuota;
import com.keshi.kotoba.analyze.StubEngine;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 卷面整份进出 JSON、交卷记录跟着卷子删，这些要连真库（先 docker compose up）。 */
@SpringBootTest
class ExamServiceIntegrationTest {

    @Autowired
    private ExamService examService;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ExamExplanationRepository explanationRepository;

    @Autowired
    private AnalyzeQuota quota;

    @Autowired
    private ObjectMapper json;

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
    @DisplayName("难度标了能改能去掉；卷子里没有的题号不收；别人标不了")
    void marksQuestions() {
        long id = examService.create(userId, "卷子", content()).id();
        assertEquals(Map.of(), examService.find(userId, id).marks());

        examService.mark(userId, id, 55, 3);
        examService.mark(userId, id, 56, 1);
        examService.mark(userId, id, 55, 2);
        assertEquals(Map.of(55, 2, 56, 1), examService.find(userId, id).marks());

        examService.unmark(userId, id, 56);
        examService.unmark(userId, id, 57);
        assertEquals(Map.of(55, 2), examService.find(userId, id).marks());

        examService.mark(userId, id, 57, 2);
        assertEquals(Map.of(2, 2), examService.list(userId).getFirst().markCounts());

        assertThrows(InvalidExamException.class, () -> examService.mark(userId, id, 99, 1));
        long other = createUser();
        assertThrows(ExamNotFoundException.class, () -> examService.mark(other, id, 55, 1));
        assertThrows(ExamNotFoundException.class, () -> examService.unmark(other, id, 55));
    }

    @Test
    @DisplayName("解析第一次调模型、存下；第二次直接读存的，卷子里也带着")
    void explainsOnceAndCaches() {
        long id = examService.create(userId, "卷子", content("文脈規定")).id();
        QuestionExplanation written = new QuestionExplanation("考点", "因为", List.of(
                new QuestionExplanation.Choice(2, "二", "不对", "", ""),
                new QuestionExplanation.Choice(1, "一", "不对", "雨が降った", "下雨了")));
        StubEngine engine = new StubEngine(written);
        ExplanationService service = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(engine), quota, json);

        QuestionExplanation first = service.explain(userId, id, 55);
        assertEquals(List.of(1, 2), first.choices().stream().map(QuestionExplanation.Choice::number).toList());
        assertTrue(engine.lastText.contains("正确答案：3"));
        assertEquals("雨[あめ]が降[ふ]った", first.choices().getFirst().example(), "例句在本地注音");
        assertEquals("下雨了", first.choices().getFirst().exampleTranslation());

        engine.lastText = null;
        assertEquals(first, service.explain(userId, id, 55));
        assertNull(engine.lastText, "存过的不该再调模型");
        assertEquals(Map.of(55, first), examService.find(userId, id).explanations());

        assertThrows(InvalidExamException.class, () -> service.explain(userId, id, 99));
        assertThrows(ExamNotFoundException.class, () -> service.explain(createUser(), id, 55));
    }

    @Test
    @DisplayName("读解题不留例句：模型硬凑的不存，早先存下的给出去之前摘掉，都不用再调模型")
    void dropsExamplesOfComprehensionQuestions() throws Exception {
        long id = examService.create(userId, "卷子", content()).id();
        QuestionExplanation written = new QuestionExplanation("考点", "因为", List.of(
                new QuestionExplanation.Choice(1, "一", "不对", "雨が降った", "下雨了"),
                new QuestionExplanation.Choice(3, "三", "正确", "風が吹いた", "刮风了")));
        StubEngine engine = new StubEngine(written);
        ExplanationService service = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(engine), quota, json);

        QuestionExplanation fresh = service.explain(userId, id, 55);
        assertTrue(engine.lastText.endsWith(ExplanationService.NO_EXAMPLES), "要告诉模型这题不造例句");
        assertEquals(List.of("", ""), fresh.choices().stream().map(QuestionExplanation.Choice::example).toList());
        assertEquals("", fresh.choices().getFirst().exampleTranslation());
        assertEquals("一", fresh.choices().getFirst().meaning(), "讲解本身不动");
        assertFalse(jdbc.queryForObject(
                "SELECT content FROM exam_explanation WHERE exam_id = ? AND question_number = 55",
                String.class, id).contains("雨が降った"), "存下的就是摘过的");

        explanationRepository.save(new ExamExplanation(id, 56, json.writeValueAsString(written), "old", Instant.now()));
        engine.lastText = null;
        assertEquals(fresh, service.explain(userId, id, 56));
        assertNull(engine.lastText, "存过的摘掉例句就行，不重新生成");
        assertEquals(fresh, examService.find(userId, id).explanations().get(56));
    }

    @Test
    @DisplayName("选项上没有例句的旧解析（例句在最外层）：再要一次就重新生成，换掉那一行")
    void regeneratesExplanationWithoutExample() {
        long id = examService.create(userId, "卷子", content()).id();
        explanationRepository.save(new ExamExplanation(id, 55,
                "{\"point\":\"旧\",\"reason\":\"\",\"choices\":[{\"number\":1,\"meaning\":\"一\",\"verdict\":\"\"}],"
                        + "\"example\":\"旧い例句\",\"exampleTranslation\":\"旧\"}", "old", Instant.now()));
        assertTrue(examService.find(userId, id).explanations().get(55).predatesChoiceExamples());

        StubEngine engine = new StubEngine(new QuestionExplanation("新", "因为", List.of(
                new QuestionExplanation.Choice(1, "一", "", "", ""))));
        ExplanationService service = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(engine), quota, json);

        assertEquals("新", service.explain(userId, id, 55).point());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM exam_explanation WHERE exam_id = ?", Integer.class, id));

        engine.lastText = null;
        assertEquals("新", service.explain(userId, id, 55).point());
        assertNull(engine.lastText, "空串例句（造不出例句的选项）不算旧的，不该再调模型");
    }

    @Test
    @DisplayName("写成日语的解析：提醒一句再要一次，要到中文的才存；还是日语就给出去但不存")
    void retriesExplanationWrittenInJapanese() {
        long id = examService.create(userId, "卷子", content()).id();
        QuestionExplanation japanese = new QuestionExplanation("文法：〜こともある",
                "空所は「小説を読むこと（　）ある」で、前文を受けて「小説を読むこともある」という意味にしたい。",
                List.of(new QuestionExplanation.Choice(1, "一", "", "", "")));
        QuestionExplanation chinese = new QuestionExplanation("文法：〜こともある",
                "前文说并非只看漫画，这里要表达「有时也会读小说」，所以选「こともある」。",
                List.of(new QuestionExplanation.Choice(1, "一", "", "", "")));

        StubEngine engine = new StubEngine(japanese, chinese);
        ExplanationService service = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(engine), quota, json);
        assertEquals(chinese.reason(), service.explain(userId, id, 55).reason());
        assertEquals(2, engine.calls);
        assertTrue(engine.lastText.endsWith(ExplanationService.IN_CHINESE), "第二次要带上提醒");
        assertEquals(chinese.reason(), examService.find(userId, id).explanations().get(55).reason());

        StubEngine stubborn = new StubEngine(japanese);
        ExplanationService again = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(stubborn), quota, json);
        assertEquals(japanese.reason(), again.explain(userId, id, 56).reason());
        assertEquals(2, stubborn.calls);
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM exam_explanation WHERE exam_id = ? AND question_number = 56",
                Integer.class, id), "还是日语的不存");
    }

    @Test
    @DisplayName("之前存下的日语解析：卷子里不带，再要一次就重新生成")
    void regeneratesSavedJapaneseExplanation() throws Exception {
        long id = examService.create(userId, "卷子", content()).id();
        QuestionExplanation japanese = new QuestionExplanation("文法：〜こともある",
                "空所は「小説を読むこと（　）ある」で、前文を受けて「小説を読むこともある」という意味にしたい。",
                List.of(new QuestionExplanation.Choice(1, "一", "", "", "")));
        explanationRepository.save(new ExamExplanation(id, 55, json.writeValueAsString(japanese),
                "old", Instant.now()));
        assertEquals(Map.of(), examService.find(userId, id).explanations());

        QuestionExplanation chinese = new QuestionExplanation("文法：〜こともある",
                "前文说并非只看漫画，这里要表达「有时也会读小说」，所以选「こともある」。",
                List.of(new QuestionExplanation.Choice(1, "一", "", "", "")));
        StubEngine engine = new StubEngine(chinese);
        ExplanationService service = new ExplanationService(examService, explanationRepository,
                StubEngine.provide(engine), quota, json);
        assertEquals(chinese.reason(), service.explain(userId, id, 55).reason());
        assertEquals(1, engine.calls);
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM exam_explanation WHERE exam_id = ?", Integer.class, id));
    }

    @Test
    @DisplayName("进度存在后端：换台设备取出来一样；再存是改；列表带做到几题；别人存不了")
    void savesProgress() {
        long id = examService.create(userId, "卷子", content()).id();
        assertNull(examService.find(userId, id).progress());
        assertEquals(0, examService.list(userId).getFirst().answeredCount());

        // 卷子里没有的題号、超出范围的选项不收
        ProgressResponse first = examService.saveProgress(userId, id, Map.of(55, 3, 99, 1, 56, 7), 90, null);
        assertEquals(Map.of(55, 3), first.answers());
        assertEquals(first, examService.find(userId, id).progress());

        AttemptResponse attempt = examService.submit(userId, id, Map.of(55, 3, 56, 4, 57, 1), 300);
        ProgressResponse done = examService.saveProgress(userId, id, Map.of(55, 3, 56, 4, 57, 1), 300,
                attempt.id());
        assertEquals(attempt.id(), done.recordedAttemptId());
        assertTrue(!done.updatedAt().isBefore(first.updatedAt()));
        ExamSummary summary = examService.list(userId).getFirst();
        assertEquals(3, summary.answeredCount());
        assertEquals(done.updatedAt(), summary.progressUpdatedAt());

        // 重做：存一份空的，行还在
        ProgressResponse reset = examService.saveProgress(userId, id, Map.of(), 0, null);
        assertEquals(Map.of(), reset.answers());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM exam_progress WHERE exam_id = ?", Integer.class, id));

        // 别的卷子的成绩记不进来
        long otherExam = examService.create(userId, "另一份", content()).id();
        AttemptResponse elsewhere = examService.submit(userId, otherExam, Map.of(55, 3), 10);
        assertNull(examService.saveProgress(userId, id, Map.of(55, 3), 10, elsewhere.id()).recordedAttemptId());

        long other = createUser();
        assertThrows(ExamNotFoundException.class,
                () -> examService.saveProgress(other, id, Map.of(55, 1), 0, null));
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
        return content("短篇阅读");
    }

    private static ExamContent content(String sectionName) {
        return new ExamContent(List.of("来源：讲义"), List.of(new ExamContent.Section("問題10", sectionName, List.of(
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
