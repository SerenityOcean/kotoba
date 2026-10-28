package com.keshi.kotoba.exam;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class ExamService {

    /** 卷面 JSON 的上限。一份 N2 读解注完音六七万字，留足余量 */
    static final int MAX_CONTENT_LENGTH = 1_000_000;

    private static final TypeReference<Map<Integer, Integer>> ANSWERS = new TypeReference<>() {
    };

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamMarkRepository markRepository;
    private final ExamExplanationRepository explanationRepository;
    private final ObjectMapper json;

    public ExamService(ExamRepository examRepository, ExamAttemptRepository attemptRepository,
                       ExamMarkRepository markRepository,
                       ExamExplanationRepository explanationRepository, ObjectMapper json) {
        this.examRepository = examRepository;
        this.attemptRepository = attemptRepository;
        this.markRepository = markRepository;
        this.explanationRepository = explanationRepository;
        this.json = json;
    }

    /** 判分的结果：留下的答案（只收卷子里有的题号、选项在范围内的），答对几题、计分几题。 */
    record Graded(Map<Integer, Integer> answers, int correct, int graded) {
    }

    /**
     * 判分。没答案的题（讲义里是「—」）不计分，所以分母是有答案的题数，
     * 不是总题数；没作答的题算错。
     */
    static Graded grade(ExamContent content, Map<Integer, Integer> answers) {
        Map<Integer, Integer> kept = new TreeMap<>();
        int correct = 0;
        int graded = 0;
        for (ExamContent.Question question : content.questions()) {
            Integer chosen = answers.get(question.number());
            if (chosen != null && chosen >= 1 && chosen <= question.choices().size()) {
                kept.put(question.number(), chosen);
            }
            if (question.answer() != null) {
                graded += 1;
                if (question.answer().equals(chosen)) correct += 1;
            }
        }
        return new Graded(kept, correct, graded);
    }

    /** 每份卷子带上做过几次、最近一次的成绩、每档难度标了几题。 */
    @Transactional(readOnly = true)
    public List<ExamSummary> list(Long userId) {
        Map<Long, List<ExamAttempt>> attempts = attemptRepository
                .findByOwnerIdOrderBySubmittedAtDesc(userId).stream()
                .collect(Collectors.groupingBy(ExamAttempt::getExamId));
        Map<Long, Map<Integer, Integer>> marks = new HashMap<>();
        for (ExamMarkRepository.MarkCount count : markRepository.countByOwner(userId)) {
            marks.computeIfAbsent(count.getExamId(), id -> new TreeMap<>())
                    .put(count.getLevel().intValue(), count.getCount().intValue());
        }
        return examRepository.findByOwnerIdOrderByCreatedAtDesc(userId).stream()
                .map(exam -> {
                    List<ExamAttempt> mine = attempts.getOrDefault(exam.id(), List.of());
                    return new ExamSummary(exam.id(), exam.title(), exam.questionCount(),
                            exam.gradedCount(), exam.createdAt(), mine.size(),
                            mine.isEmpty() ? null : attemptResponse(mine.getFirst()),
                            marks.getOrDefault(exam.id(), Map.of()));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamResponse find(Long userId, Long id) {
        Exam exam = load(userId, id);
        Map<Integer, Integer> marks = new TreeMap<>();
        for (ExamMark mark : markRepository.findByExamId(id)) {
            marks.put(mark.getQuestionNumber(), mark.getLevel());
        }
        Map<Integer, QuestionExplanation> explanations = new TreeMap<>();
        for (ExamExplanation saved : explanationRepository.findByExamId(id)) {
            explanations.put(saved.getQuestionNumber(),
                    json.readValue(saved.getContent(), QuestionExplanation.class));
        }
        return response(exam, attemptRepository
                .findByExamIdAndOwnerIdOrderBySubmittedAtDesc(id, userId).stream()
                .map(this::attemptResponse)
                .toList(), marks, explanations);
    }

    @Transactional
    public ExamResponse create(Long userId, String title, ExamContent content) {
        List<ExamContent.Question> questions = content.questions();
        if (questions.isEmpty()) {
            throw new InvalidExamException("卷子里没有题目");
        }
        // 判分按题号对答案，号重了就分不清是哪一题
        Set<Integer> numbers = new HashSet<>();
        for (ExamContent.Question question : questions) {
            if (!numbers.add(question.number())) {
                throw new InvalidExamException("問" + question.number() + " 出现了两次");
            }
        }
        String body = json.writeValueAsString(content);
        if (body.length() > MAX_CONTENT_LENGTH) {
            throw new InvalidExamException("卷子太大了");
        }
        int graded = (int) questions.stream().filter(q -> q.answer() != null).count();
        return response(examRepository.save(
                new Exam(userId, title, body, questions.size(), graded, Instant.now())),
                List.of(), Map.of(), Map.of());
    }

    @Transactional
    public void delete(Long userId, Long id) {
        // 交卷记录由外键 ON DELETE CASCADE 一起删
        examRepository.delete(load(userId, id));
    }

    /** 交卷：按卷子里存的答案判分，连作答一起存下。 */
    @Transactional
    public AttemptResponse submit(Long userId, Long examId, Map<Integer, Integer> answers,
                                  int elapsedSeconds) {
        Exam exam = load(userId, examId);
        Graded graded = grade(content(exam), answers);
        ExamAttempt attempt = attemptRepository.save(new ExamAttempt(
                examId, userId, json.writeValueAsString(graded.answers()),
                graded.correct(), graded.graded(), elapsedSeconds, Instant.now()));
        return attemptResponse(attempt);
    }

    /** 给一道题标难度，标过的就改成新的。 */
    @Transactional
    public void mark(Long userId, Long examId, int number, int level) {
        Exam exam = load(userId, examId);
        if (content(exam).questions().stream().noneMatch(q -> q.number() == number)) {
            throw new InvalidExamException("卷子里没有問" + number);
        }
        markRepository.findByExamIdAndQuestionNumber(examId, number)
                .ifPresentOrElse(
                        mark -> mark.mark(level, Instant.now()),
                        () -> markRepository.save(new ExamMark(examId, number, level, Instant.now())));
    }

    /** 去掉一道题的难度标记。本来就没标也不报错。 */
    @Transactional
    public void unmark(Long userId, Long examId, int number) {
        load(userId, examId);
        markRepository.deleteByExamIdAndQuestionNumber(examId, number);
    }

    /** 这个人的一份卷子的卷面；不是他的就当没有。 */
    @Transactional(readOnly = true)
    ExamContent content(Long userId, Long id) {
        return content(load(userId, id));
    }

    private Exam load(Long userId, Long id) {
        return examRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new ExamNotFoundException(id));
    }

    private ExamContent content(Exam exam) {
        return json.readValue(exam.getContent(), ExamContent.class);
    }

    private ExamResponse response(Exam exam, List<AttemptResponse> attempts,
                                  Map<Integer, Integer> marks,
                                  Map<Integer, QuestionExplanation> explanations) {
        return new ExamResponse(exam.getId(), exam.getTitle(), content(exam),
                exam.getQuestionCount(), exam.getGradedCount(), exam.getCreatedAt(), attempts, marks,
                explanations);
    }

    private AttemptResponse attemptResponse(ExamAttempt attempt) {
        return new AttemptResponse(attempt.getId(), json.readValue(attempt.getAnswers(), ANSWERS),
                attempt.getCorrect(), attempt.getGraded(), attempt.getElapsedSeconds(),
                attempt.getSubmittedAt());
    }
}
