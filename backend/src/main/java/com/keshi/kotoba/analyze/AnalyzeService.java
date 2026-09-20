package com.keshi.kotoba.analyze;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AnalyzeService {

    /**
     * 提示词的一半在这儿，另一半是 {@link Analysis} 那几个 record 上的
     * {@code @JsonPropertyDescription} —— 它们一起变成模型看到的 JSON schema。
     * 改输出格式要两边一起看。换模型服务不影响这里。
     */
    private static final String SYSTEM_PROMPT = """
            你是日语教学助手，读者是中文母语的日语学习者。把用户粘贴的日语文本拆开讲清楚。

            规则：
            1. 先按句号、问号、感叹号或换行把原文切成句子，逐句处理，保持原顺序。
               original 原样照抄那一句，不要改写、不要补标点。
            2. translation 是自然通顺的中文，不要逐字硬译。
            3. verbs 列出句中每一个活用了的动词和形容词。form 要说清整条活用链，
               比如「使役被动 + 过去式」「て形 + 存续」。原形出现（没活用）的动词不用列。
            4. 「〜てしまう」「〜ておく」这类补助动词结构算语法点，放 grammarPoints，
               不要在 verbs 里重复一遍。
            5. grammarPoints 收句型、惯用表达、助词的非基础用法。は・が・を 这种
               入门就会的基本用法不用列，列了反而吵。
            6. 所有讲解用中文写，日语词句保持日语原样。
            7. 吃不准的地方宁可少写一条，不要编。
            8. 日语原文里的汉字一律注音，用方括号写在汉字后面，例如
               「東日本[ひがしにほん]」「来[き]そう」。
               注意只把汉字本身放进方括号前面，送り仮名留在外面 ——
               写「食[た]べる」，不要写「食べ[たべ]る」，后者显示不出来。
               需要注音的是 original、surface、example 三个字段；
               pattern 和各种中文讲解里不用。
            """;

    private final ObjectProvider<AnalysisEngine> engines;

    public AnalyzeService(ObjectProvider<AnalysisEngine> engines) {
        this.engines = engines;
    }

    public Analysis analyze(String text) {
        AnalysisEngine engine = engines.getIfAvailable();
        if (engine == null) {
            throw new AnalysisUnavailableException();
        }

        Analysis analysis = engine.analyze(SYSTEM_PROMPT, text.strip());

        // schema 保证不了「数组非空」，下游（前端建卡）按空列表处理更省事
        return new Analysis(
                analysis == null || analysis.sentences() == null ? List.of() : analysis.sentences());
    }
}
