package com.keshi.kotoba.analyze;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 读的时候选中一段，除了拆解还能做的两件事：只要译文、就着这段提问。
 * 和拆解共用同一个模型服务和同一份配额，结果都不落库。
 */
@Service
public class ReadingAssistService {

    /** 提示词的一半在这儿，另一半是 {@link Translation} 上的字段说明。 */
    static final String TRANSLATE_PROMPT = """
            你是日语教学助手，读者是中文母语的日语学习者。把「选中的日语」译成中文。

            规则：
            1. 译文自然通顺，不要逐字硬译，也不要添原文没有的意思。
            2. 只译「选中的日语」这一段。「上下文」是它在原文里的前后文，只用来弄清
               指代、省略掉的主语和语气，不要把上下文也译出来。
            3. 选中的只是半句、一个词时，就译这半句、这个词在这里的意思。
            4. 只给译文，不解释语法，不加引号和注音。
            """;

    /** 提示词的一半在这儿，另一半是 {@link Answer} 上的字段说明。 */
    static final String ASK_PROMPT = """
            你是日语老师，读者是中文母语的日语学习者，正在读一段日语，选中了其中一段向你提问。
            就着「选中的日语」回答「现在的问题」。

            规则：
            1. 全部用中文讲。日语只在「」里引用，照原样写；需要读音就用括号注在后面，
               例如「行事（ぎょうじ）」，不要用方括号。
            2. 先直接回答问的那一点，再补必要的依据：接续、活用怎么变来的、
               和相近说法的区别。不要把整句从头拆一遍，除非问的就是这个。
            3. 「上下文」是选中那段在原文里的前后文，用来判断主语、指代和语气；
               问题和上下文有关（比如这是一道题的选项，问为什么不选它）就结合着讲。
            4. 「之前的问答」是读者就着同一段已经问过的，接着问时不要重复讲过的内容。
            5. 简短：一般 2–5 句。举例句时日语后面跟中文意思。
            6. 纯文本，分段用换行。不要用 Markdown 记号（#、*、- 开头的列表、反引号）。
               要加引号用「」或“”，不要用英文双引号。
            7. 问题和日语学习无关的，一句话说明这里只答日语相关的问题。
            8. 吃不准的地方直说吃不准，不要编。
            """;

    private final ObjectProvider<AnalysisEngine> engines;

    public ReadingAssistService(ObjectProvider<AnalysisEngine> engines) {
        this.engines = engines;
    }

    public Translation translate(String text, String context) {
        Translation translation = engine().generate(
                TRANSLATE_PROMPT, quoted(text, context).toString(), Translation.class);
        if (translation == null || translation.translation() == null || translation.translation().isBlank()) {
            throw new AnalysisFailedException("模型没有给出译文，再试一次", null);
        }
        return new Translation(translation.translation().strip());
    }

    public Answer ask(String text, String question, String context, List<AskRequest.Exchange> history) {
        StringBuilder prompt = quoted(text, context);
        if (history != null && !history.isEmpty()) {
            prompt.append("\n\n【之前的问答】");
            for (AskRequest.Exchange exchange : history) {
                prompt.append("\n问：").append(exchange.question().strip())
                        .append("\n答：").append(exchange.answer().strip());
            }
        }
        prompt.append("\n\n【现在的问题】\n").append(question.strip());

        Answer answer = engine().generate(ASK_PROMPT, prompt.toString(), Answer.class);
        if (answer == null || answer.answer() == null || answer.answer().isBlank()) {
            throw new AnalysisFailedException("模型没有回答，再问一次", null);
        }
        return new Answer(answer.answer().strip());
    }

    private AnalysisEngine engine() {
        AnalysisEngine engine = engines.getIfAvailable();
        if (engine == null) {
            throw new AnalysisUnavailableException();
        }
        return engine;
    }

    /** 选中的那段在前；上下文和它一样（选的就是整段）或者没有，就不写上下文 */
    private static StringBuilder quoted(String text, String context) {
        String selected = text.strip();
        StringBuilder prompt = new StringBuilder("【选中的日语】\n").append(selected);
        if (context != null && !context.isBlank() && !context.strip().equals(selected)) {
            prompt.append("\n\n【上下文】\n").append(context.strip());
        }
        return prompt;
    }
}
