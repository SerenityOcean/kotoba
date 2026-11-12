package com.keshi.kotoba.exam;

import com.keshi.kotoba.analyze.AnalysisEngine;
import com.keshi.kotoba.analyze.AnalysisUnavailableException;
import com.keshi.kotoba.analyze.AnalyzeQuota;
import com.keshi.kotoba.text.FuriganaNotation;
import com.keshi.kotoba.text.JapaneseReading;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
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

    private static final Logger log = LoggerFactory.getLogger(ExplanationService.class);

    /**
     * 提示词的一半在这儿，另一半是 {@link QuestionExplanation} 上的字段说明。
     */
    static final String SYSTEM_PROMPT = """
            你是 JLPT 备考老师，读者是中文母语、在备考 N2 的学习者。用户给你一道真题：
            大题类型、需要时附上本文、题干、四个选项和正确答案。把这道题讲透。

            讲解一律用中文写：point、reason、meaning、verdict 都是中文，哪怕题目和选项全是日语、
            题型名是日语。日语只在「」里引用，不要用日语写句子。

            规则：
            1. point 一句话说清这题考什么。
            2. reason 讲为什么选正确答案。读解题要指出本文里哪一句是依据；
               语法题讲接续和意思；词汇题讲词义和搭配。2–4 句。
            3. choices 每个选项一项，按顺序，number 从 1 数，不能漏也不能多。
               meaning 只讲选项本身是什么意思，verdict 讲它放进这道题为什么对、为什么不对。
               正确答案那项的 verdict 说它为什么成立。
            4. 题目里 ⟦⟧ 括起来的是原卷画下划线的部分；★ 是排列题要回答的那个空；
               （　）和【数字】是要填的空。
            5. 再说一遍：全部用中文讲 —— 题目和选项是日语，讲解也必须是中文，不要整段写日语。
               引用日语照原样写，需要读音就用括号注在后面，
               例如「行事（ぎょうじ）」，不要用方括号。要加引号用「」，不要用英文双引号。
            6. 给了正确答案就以它为准，不要另选。没给答案的，自己判断，
               在 reason 开头写明「讲义没给答案，按题意应选 X」。
            7. 吃不准的地方不要编。
            8. example 不是每个选项都要有，不要为了凑数硬造。选项是真实存在的词或句型、
               读者值得看一眼它在别的句子里怎么用，才用它另造一个例句，exampleTranslation
               是它的中文翻译；错误选项只要是真词也造 —— 读者要分清的正是这几个词各自怎么用。
               下面这些 example 和 exampleTranslation 都写空串：
               · 读解题：选项是对本文内容的概括，不是要学的词；
               · 选项不是真实存在的词或读法：读音题里把一个字换了读法凑出来的干扰项
                 （「省略」的「しょうかく」「しょうらく」），哪怕碰巧和别的词同音也不造；
                 汉字表记题里凑出来的假词（「困乱」）；
               · 题目末尾写了「例句：……」的，照那句办。
               读音题的错误选项本身是另一个真词时（例如「湿って」那题里的「にごって」是
               「濁って」），用那个词、写成汉字造句。
               例句要自然、是 N2 学习者会碰到的场景，不要照搬题目原句，几个例句不要雷同。
            9. JSON 的括号要成对：每个对象写完先用 } 收口，再用 ] 收数组。
            """;

    /** 写成日语时再要一次，补在题目后面的那句话 */
    static final String IN_CHINESE = "\n\n（上一次你把讲解写成了日语。这次 point、reason、meaning、verdict "
            + "必须全部用中文写，日语只在「」里引用。）";

    /** 读解题补在题目后面的那句话：选项是内容概括，不造例句 */
    static final String NO_EXAMPLES = "\n\n例句：这是读解题，选项是对本文的概括。"
            + "所有选项的 example 和 exampleTranslation 都写空串。";

    /** 熟语的读音题补在题目后面的那句话：错误选项是凑出来的读法，只有正确答案造例句 */
    static final String EXAMPLE_FOR_ANSWER_ONLY = "\n\n例句：错误选项是换了读法凑出来的，不是词。"
            + "只给正确选项造例句，其余选项的 example 和 exampleTranslation 都写空串。";

    /**
     * 写成日语了，第一次回得快才再要一次：两次加起来不能超过 nginx 的
     * proxy_read_timeout（120 秒），第二次最长要等 analyze.openai.timeout-seconds（90 秒）
     */
    private static final Duration RETRY_WITHIN = Duration.ofSeconds(30);

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
        Optional<ExamExplanation> row = repository.findByExamIdAndQuestionNumber(examId, number);
        Optional<QuestionExplanation> saved = row.map(this::read);
        // 选项上还没有例句、或者写成了日语的旧解析：再点一次就重新生成，换掉旧的
        if (saved.isPresent() && !saved.get().predatesChoiceExamples() && !saved.get().writtenInJapanese()) {
            return ChoiceExamples.prune(content, number, saved.get());
        }

        String prompt = describe(content, number)
                .orElseThrow(() -> new InvalidExamException("卷子里没有問" + number));
        AnalysisEngine engine = engines.getIfAvailable();
        if (engine == null) {
            throw new AnalysisUnavailableException();
        }
        quota.acquire(userId);

        Instant start = Instant.now();
        QuestionExplanation explanation = tidy(
                engine.generate(SYSTEM_PROMPT, prompt, QuestionExplanation.class));
        if (explanation.writtenInJapanese()
                && Duration.between(start, Instant.now()).compareTo(RETRY_WITHIN) < 0) {
            log.warn("問{} 的解析写成了日语（{}），提醒一句再要一次", number, engine.describe());
            explanation = tidy(engine.generate(SYSTEM_PROMPT, prompt + IN_CHINESE, QuestionExplanation.class));
        }
        // 这道题不该有的例句，模型硬凑了也摘掉，存下的就是摘过的
        explanation = ChoiceExamples.prune(content, number, explanation);
        if (explanation.writtenInJapanese()) {
            // 照样给出去，总比什么都没有强；但不存：下次点开重新生成
            log.warn("問{} 的解析还是日语（{}），这次不存", number, engine.describe());
            return explanation;
        }
        String written = json.writeValueAsString(explanation);
        try {
            if (row.isPresent()) {
                row.get().replace(written, engine.describe(), Instant.now());
                repository.save(row.get());
            } else {
                repository.save(new ExamExplanation(examId, number, written, engine.describe(), Instant.now()));
            }
        } catch (DataIntegrityViolationException e) {
            // 同一题点了两下，两边同时在写：先存下的那份为准，前后看到的才一样
            return find(examId, number).orElse(explanation);
        }
        return explanation;
    }

    private Optional<QuestionExplanation> find(Long examId, int number) {
        return repository.findByExamIdAndQuestionNumber(examId, number).map(this::read);
    }

    private QuestionExplanation read(ExamExplanation saved) {
        return json.readValue(saved.getContent(), QuestionExplanation.class);
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
        out.append(switch (ChoiceExamples.scope(section, passage, question)) {
            case NONE -> NO_EXAMPLES;
            case ANSWER_ONLY -> EXAMPLE_FOR_ANSWER_ONLY;
            case ALL -> "";
        });
        return out.toString();
    }

    private static String plain(String text) {
        return RUBY.matcher(text).replaceAll("$1");
    }

    /** 选项按序号排好；null 换成空串，界面不用防；每个选项的例句在本地注上音。 */
    static QuestionExplanation tidy(QuestionExplanation explanation) {
        if (explanation == null) {
            return new QuestionExplanation("", "", List.of());
        }
        List<QuestionExplanation.Choice> choices = explanation.choices() == null
                ? List.of()
                : explanation.choices().stream()
                        .sorted(Comparator.comparingInt(QuestionExplanation.Choice::number))
                        .map(ExplanationService::tidy)
                        .toList();
        return new QuestionExplanation(
                explanation.point() == null ? "" : explanation.point(),
                explanation.reason() == null ? "" : explanation.reason(),
                choices);
    }

    private static QuestionExplanation.Choice tidy(QuestionExplanation.Choice choice) {
        String example = choice.example() == null ? "" : choice.example().strip();
        return new QuestionExplanation.Choice(
                choice.number(),
                choice.meaning() == null ? "" : choice.meaning(),
                choice.verdict() == null ? "" : choice.verdict(),
                example.isEmpty() ? "" : JapaneseReading.annotate(FuriganaNotation.bracketize(example)),
                example.isEmpty() || choice.exampleTranslation() == null ? ""
                        : choice.exampleTranslation().strip());
    }
}
