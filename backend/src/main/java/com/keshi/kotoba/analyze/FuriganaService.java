package com.keshi.kotoba.analyze;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * 给日语文本加注音，用 Anki 那套方括号记法。
 *
 * <p>让模型重写整段正文是有风险的：它可能顺手改字、删句、补标点。
 * 对阅读功能来说把文章改了比没注音严重得多，所以注完要校验 ——
 * 把注音剥掉必须和原文一字不差，对不上就退回原文。
 */
@Service
public class FuriganaService {

    private static final String SYSTEM_PROMPT = """
            给日语文本加注音，用方括号记法把读音写在汉字后面，例如
            「東日本[ひがしにほん]の太平洋[たいへいよう]側[がわ]」。

            铁律：
            1. 除了插入「[读音]」，原文一个字都不准改。不要改标点、不要补字、
               不要删字、不要调整换行、不要翻译、不要解释。
            2. 只把汉字本身放在方括号前面，送り仮名留在外面：
               写「食[た]べる」，不要写「食べ[たべ]る」。
            3. 假名和数字不用注音。已经有注音的地方保持原样。
            4. 直接输出注好音的全文，不要加任何前言后语，不要用代码块包起来。
            """;

    /** 和前端 Furigana 组件同一套记法：底字只认汉字。 */
    private static final Pattern RUBY = Pattern.compile("([一-鿿々〆ヶ]+)\\[([^\\[\\]]+)\\]");

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final ObjectProvider<AnalysisEngine> engines;

    public FuriganaService(ObjectProvider<AnalysisEngine> engines) {
        this.engines = engines;
    }

    public FuriganaResult annotate(String text) {
        AnalysisEngine engine = engines.getIfAvailable();
        if (engine == null) {
            throw new AnalysisUnavailableException();
        }

        String annotated = engine.annotate(SYSTEM_PROMPT, text.strip()).strip();

        // 剥掉注音后必须还是原文，否则模型改了内容，宁可不注音
        if (!sameText(text, strip(annotated))) {
            return new FuriganaResult(text, false);
        }
        return new FuriganaResult(annotated, true);
    }

    /** 去掉方括号记法，留下底字。 */
    static String strip(String annotated) {
        return RUBY.matcher(annotated).replaceAll("$1");
    }

    /** 空白差异不算改动 —— 模型常把换行变成空格，那个不伤内容。 */
    private static boolean sameText(String a, String b) {
        return WHITESPACE.matcher(a).replaceAll("").equals(WHITESPACE.matcher(b).replaceAll(""));
    }
}
