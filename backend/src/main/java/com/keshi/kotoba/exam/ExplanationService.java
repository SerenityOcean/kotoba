package com.keshi.kotoba.exam;

import com.keshi.kotoba.analyze.AnalysisEngine;
import com.keshi.kotoba.analyze.AnalysisUnavailableException;
import com.keshi.kotoba.analyze.AnalyzeQuota;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 应试的「解析」：一道题四个选项各是什么意思、为什么选正解。和拆解共用同一个模型服务
 * 和同一份配额，结果按题存下 —— 同一道题第二次看不再调模型。
 */
@Service
public class ExplanationService {

    /**
     * 提示词的一半在这儿，另一半是 {@link QuestionExplanation} 上的字段说明。
     */
    static final String SYSTEM_PROMPT = """
            你是 JLPT 备考老师，读者是中文母语、在备考 N2 的学习者。用户给你一道真题：
            大题类型、需要时附上本文、题干、四个选项和正确答案。把这道题讲透。

            规则：
            1. point 一句话说清这题考什么。
            2. reason 讲为什么选正确答案。读解题要指出本文里哪一句是依据；
               语法题讲接续和意思；词汇题讲词义和搭配。2–4 句。
            3. choices 每个选项一项，按顺序，number 从 1 数，不能漏也不能多。
               meaning 只讲选项本身是什么意思，verdict 讲它放进这道题为什么对、为什么不对。
               正确答案那项的 verdict 说它为什么成立。
            4. 题目里 ⟦⟧ 括起来的是原卷画下划线的部分；★ 是排列题要回答的那个空；
               （　）和【数字】是要填的空。
            5. 全部用中文讲。引用日语照原样写，需要读音就用括号注在后面，
               例如「行事（ぎょうじ）」，不要用方括号。
            6. 给了正确答案就以它为准，不要另选。没给答案的，自己判断，
               在 reason 开头写明「讲义没给答案，按题意应选 X」。
            7. 吃不准的地方不要编。
            8. JSON 的括号要成对：每个对象写完先用 } 收口，再用 ] 收数组。
            """;

    /** 卷面里的注音是「行事[ぎょうじ]」，送给模型前摘掉：读音题里注音就是答案 */
    private static final Pattern RUBY = Pattern.compile("([\\u4E00-\\u9FFF々〆ヶ]+)\\[[^\\[\\]]+\\]");

    private final ExamService examService;
    private final ExamExplanationRepository repository;
    private final ObjectProvider<AnalysisEngine> engines;
    private final AnalyzeQuota quota;
    private final ObjectMapper json;

    public ExplanationService(ExamService examService, ExamExplanationRepository repository,
                              ObjectProvider<AnalysisEngine> engines, AnalyzeQuota quota,
                              ObjectMapper json) {
        this.examService = examService;
        this.repository = repository;
        this.engines = engines;
        this.quota = quota;
        this.json = json;
    }

    /**
     * 有存下的就直接给；没有才调模型，写完存下。调模型要十几秒，不包在事务里。
     */
    public QuestionExplanation explain(Long userId, Long examId, int number) {
        ExamContent content = examService.content(userId, examId);
        Optional<QuestionExplanation> saved = find(examId, number);
        if (saved.isPresent()) {
            return saved.get();
        }

        String prompt = describe(content, number)
                .orElseThrow(() -> new InvalidExamException("卷子里没有問" + number));
        AnalysisEngine engine = engines.getIfAvailable();
        if (engine == null) {
            throw new AnalysisUnavailableException();
        }
        quota.acquire(userId);

        QuestionExplanation explanation = tidy(
                engine.generate(SYSTEM_PROMPT, prompt, QuestionExplanation.class));
        try {
            repository.save(new ExamExplanation(examId, number,
                    json.writeValueAsString(explanation), engine.describe(), Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // 同一题点了两下，两边同时在写：先存下的那份为准，前后看到的才一样
            return find(examId, number).orElse(explanation);
        }
        return explanation;
    }

    private Optional<QuestionExplanation> find(Long examId, int number) {
        return repository.findByExamIdAndQuestionNumber(examId, number)
                .map(saved -> json.readValue(saved.getContent(), QuestionExplanation.class));
    }

    /**
     * 把一道题写成给模型看的样子：大题类型、本文（有的话）、题干、选项、正确答案。
     * 读解题离了本文讲不清依据；漢字読み 这种没有本文，就只有题。
     */
    static Optional<String> describe(ExamContent content, int number) {
        for (ExamContent.Section section : content.sections()) {
            for (ExamContent.Passage passage : section.passages()) {
                for (ExamContent.Question question : passage.questions()) {
                    if (question.number() == number) {
                        return Optional.of(describe(section, passage, question));
                    }
                }
            }
        }
        return Optional.empty();
    }

    private static String describe(ExamContent.Section section, ExamContent.Passage passage,
                                   ExamContent.Question question) {
        StringBuilder out = new StringBuilder();
        String kind = (section.label() + "　" + section.name()).strip();
        if (!kind.isEmpty()) {
            out.append("大题：").append(kind).append("\n\n");
        }
        if (!passage.blocks().isEmpty()) {
            out.append(passage.label().isEmpty() ? "本文" : passage.label()).append("：\n");
            for (ExamContent.Block block : passage.blocks()) {
                if (block.mark() != null) {
                    out.append(block.mark()).append("　");
                }
                out.append(plain(block.text())).append('\n');
            }
            out.append('\n');
        }
        out.append("题目：問").append(question.number()).append("　")
                .append(plain(question.stem())).append('\n');
        for (String line : question.extra()) {
            out.append(plain(line)).append('\n');
        }
        out.append("\n选项：\n");
        List<String> choices = question.choices();
        for (int i = 0; i < choices.size(); i++) {
            out.append(i + 1).append(". ").append(plain(choices.get(i))).append('\n');
        }
        out.append('\n').append(question.answer() == null
                ? "讲义没给正确答案。"
                : "正确答案：" + question.answer());
        return out.toString();
    }

    private static String plain(String text) {
        return RUBY.matcher(text).replaceAll("$1");
    }

    /** 选项按序号排好；null 换成空，界面不用防。 */
    static QuestionExplanation tidy(QuestionExplanation explanation) {
        if (explanation == null) {
            return new QuestionExplanation("", "", List.of());
        }
        List<QuestionExplanation.Choice> choices = explanation.choices() == null
                ? List.of()
                : explanation.choices().stream()
                        .sorted(Comparator.comparingInt(QuestionExplanation.Choice::number))
                        .toList();
        return new QuestionExplanation(
                explanation.point() == null ? "" : explanation.point(),
                explanation.reason() == null ? "" : explanation.reason(),
                choices);
    }
}
