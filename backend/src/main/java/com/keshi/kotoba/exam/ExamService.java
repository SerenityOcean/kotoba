package com.keshi.kotoba.exam;

import com.keshi.kotoba.folder.Folder;
import com.keshi.kotoba.folder.FolderService;
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
    private final ExamProgressRepository progressRepository;
    private final ObjectMapper json;
    private final FolderService folderService;

    public ExamService(ExamRepository examRepository, ExamAttemptRepository attemptRepository,
                       ExamMarkRepository markRepository,
                       ExamExplanationRepository explanationRepository,
                       ExamProgressRepository progressRepository, ObjectMapper json,
                       FolderService folderService) {
        this.examRepository = examRepository;
        this.attemptRepository = attemptRepository;
        this.markRepository = markRepository;
        this.explanationRepository = explanationRepository;
        this.progressRepository = progressRepository;
        this.json = json;
        this.folderService = folderService;
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

    /** 每份卷子带上做过几次、最近一次的成绩、每档难度标了几题、做到第几题。 */
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
        Map<Long, ExamProgress> progress = progressRepository.findByOwner(userId).stream()
                .collect(Collectors.toMap(ExamProgress::getExamId, p -> p));
        return examRepository.findByOwnerIdOrderByCreatedAtDesc(userId).stream()
                .map(exam -> {
                    List<ExamAttempt> mine = attempts.getOrDefault(exam.id(), List.of());
                    ExamProgress saved = progress.get(exam.id());
                    return new ExamSummary(exam.id(), exam.title(), exam.questionCount(),
                            exam.gradedCount(), exam.createdAt(), exam.folderId(), mine.size(),
                            mine.isEmpty() ? null : attemptResponse(mine.getFirst()),
                            marks.getOrDefault(exam.id(), Map.of()),
                            saved == null ? 0 : json.readValue(saved.getAnswers(), ANSWERS).size(),
                            saved == null ? null : saved.getUpdatedAt());
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
        List<ExamExplanation> saved = explanationRepository.findByExamId(id);
        ExamContent content = saved.isEmpty() ? null : content(exam);
        Map<Integer, QuestionExplanation> explanations = new TreeMap<>();
        for (ExamExplanation row : saved) {
            QuestionExplanation explanation = json.readValue(row.getContent(), QuestionExplanation.class);
            // 写成日语的当没生成过：页面上点「解析」会重新要一份中文的
            if (!explanation.writtenInJapanese()) {
                // 早先存下的解析每个选项都硬凑了例句，给出去之前按题型摘掉
                explanations.put(row.getQuestionNumber(),
                        ChoiceExamples.prune(content, row.getQuestionNumber(), explanation));
            }
        }
        return response(exam, attemptRepository
                .findByExamIdAndOwnerIdOrderBySubmittedAtDesc(id, userId).stream()
                .map(this::attemptResponse)
                .toList(), marks, explanations,
                progressRepository.findById(id).map(this::progressResponse).orElse(null));
    }

    @Transactional
    public ExamResponse create(Long userId, String title, ExamContent content) {
        return create(userId, title, content, null);
    }

    /** 存进某个集；folderId 为空就是未归档。集必须是这个人的真题集。 */
    @Transactional
    public ExamResponse create(Long userId, String title, ExamContent content, Long folderId) {
        folderService.requireKind(userId, folderId, Folder.Kind.EXAM);
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
                new Exam(userId, title, body, questions.size(), graded, Instant.now(), folderId)),
                List.of(), Map.of(), Map.of(), null);
    }

    /** 把这些卷子挪进某个集；folderId 为空是退回未归档。返回真正挪了几份。 */
    @Transactional
    public int moveToFolder(Long userId, List<Long> ids, Long folderId) {
        folderService.requireKind(userId, folderId, Folder.Kind.EXAM);
        int moved = 0;
        for (Exam exam : examRepository.findAllById(ids)) {
            if (exam.getOwnerId().equals(userId)) {
                exam.moveTo(folderId);
                moved++;
            }
        }
        return moved;
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

    /** 这份卷子的进度，没存过是 null。 */
    @Transactional(readOnly = true)
    public ProgressResponse progress(Long userId, Long examId) {
        load(userId, examId);
        return progressRepository.findById(examId).map(this::progressResponse).orElse(null);
    }

    /**
     * 存做到一半的进度，存过的就改成新的。卷子里没有的题号、超出范围的选项不收；
     * 记下的成绩不是这份卷子的就当没有。重做是存一份空的，不删：留着时间好比新旧。
     */
    @Transactional
    public ProgressResponse saveProgress(Long userId, Long examId, Map<Integer, Integer> answers,
                                         int elapsedSeconds, Long recordedAttemptId) {
        Exam exam = load(userId, examId);
        String kept = json.writeValueAsString(grade(content(exam), answers).answers());
        Long recorded = recordedAttemptId == null ? null : attemptRepository.findById(recordedAttemptId)
                .filter(a -> a.getExamId().equals(examId) && a.getOwnerId().equals(userId))
                .map(ExamAttempt::getId)
                .orElse(null);
        Instant now = Instant.now();
        ExamProgress progress = progressRepository.findById(examId)
                .map(saved -> {
                    saved.update(kept, elapsedSeconds, recorded, now);
                    return saved;
                })
                .orElseGet(() -> progressRepository.save(
                        new ExamProgress(examId, kept, elapsedSeconds, recorded, now)));
        return progressResponse(progress);
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
                                  Map<Integer, QuestionExplanation> explanations,
                                  ProgressResponse progress) {
        return new ExamResponse(exam.getId(), exam.getTitle(), content(exam),
                exam.getQuestionCount(), exam.getGradedCount(), exam.getCreatedAt(), exam.getFolderId(),
                attempts, marks,
                explanations, progress);
    }

    private ProgressResponse progressResponse(ExamProgress progress) {
        return new ProgressResponse(json.readValue(progress.getAnswers(), ANSWERS),
                progress.getElapsedSeconds(), progress.getRecordedAttemptId(), progress.getUpdatedAt());
    }

    private AttemptResponse attemptResponse(ExamAttempt attempt) {
        return new AttemptResponse(attempt.getId(), json.readValue(attempt.getAnswers(), ANSWERS),
                attempt.getCorrect(), attempt.getGraded(), attempt.getElapsedSeconds(),
                attempt.getSubmittedAt());
    }
}
