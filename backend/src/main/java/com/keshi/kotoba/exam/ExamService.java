package com.keshi.kotoba.exam;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
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
    private final ObjectMapper json;

    public ExamService(ExamRepository examRepository, ExamAttemptRepository attemptRepository,
                       ObjectMapper json) {
        this.examRepository = examRepository;
        this.attemptRepository = attemptRepository;
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

    /** 每份卷子带上做过几次、最近一次的成绩。 */
    @Transactional(readOnly = true)
    public List<ExamSummary> list(Long userId) {
        Map<Long, List<ExamAttempt>> attempts = attemptRepository
                .findByOwnerIdOrderBySubmittedAtDesc(userId).stream()
                .collect(Collectors.groupingBy(ExamAttempt::getExamId));
        return examRepository.findByOwnerIdOrderByCreatedAtDesc(userId).stream()
                .map(exam -> {
                    List<ExamAttempt> mine = attempts.getOrDefault(exam.id(), List.of());
                    return new ExamSummary(exam.id(), exam.title(), exam.questionCount(),
                            exam.gradedCount(), exam.createdAt(), mine.size(),
                            mine.isEmpty() ? null : attemptResponse(mine.getFirst()));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamResponse find(Long userId, Long id) {
        Exam exam = load(userId, id);
        return response(exam, attemptRepository
                .findByExamIdAndOwnerIdOrderBySubmittedAtDesc(id, userId).stream()
                .map(this::attemptResponse)
                .toList());
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
                new Exam(userId, title, body, questions.size(), graded, Instant.now())), List.of());
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

    private Exam load(Long userId, Long id) {
        return examRepository.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new ExamNotFoundException(id));
    }

    private ExamContent content(Exam exam) {
        return json.readValue(exam.getContent(), ExamContent.class);
    }

    private ExamResponse response(Exam exam, List<AttemptResponse> attempts) {
        return new ExamResponse(exam.getId(), exam.getTitle(), content(exam),
                exam.getQuestionCount(), exam.getGradedCount(), exam.getCreatedAt(), attempts);
    }

    private AttemptResponse attemptResponse(ExamAttempt attempt) {
        return new AttemptResponse(attempt.getId(), json.readValue(attempt.getAnswers(), ANSWERS),
                attempt.getCorrect(), attempt.getGraded(), attempt.getElapsedSeconds(),
                attempt.getSubmittedAt());
    }
}
