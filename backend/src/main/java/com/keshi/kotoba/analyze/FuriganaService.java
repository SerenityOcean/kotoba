package com.keshi.kotoba.analyze;

import com.keshi.kotoba.text.FuriganaNotation;
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
            3. 假名和数字不用注音。已经是「[读音]」这种方括号形式的保持原样。
            4. 直接输出注好音的全文，不要加任何前言后语，不要用代码块包起来。
            """;

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

        // 先做确定性的那一半：原文里「漢字（かな）」形式的注音直接转成方括号。
        // 从带 ruby 的网页复制下来的文本几乎都是这样，这部分不该花钱问模型，
        // 也不该冒模型改错的风险。
        String prepared = bracketize(text.strip());

        String annotated = engine.annotate(SYSTEM_PROMPT, prepared).strip();

        // 剥掉注音后两边必须一字不差，否则模型改了正文内容，宁可不注音。
        // 注意基准是 prepared 而不是原文 —— 括号转换本身是有意的改动。
        if (!sameText(strip(prepared), strip(annotated))) {
            // 退回 prepared 而不是原文：括号转换是确定性的，那部分照样算数
            return new FuriganaResult(prepared, false);
        }
        return new FuriganaResult(annotated, true);
    }

    /** 「価値（かち）」→「価値[かち]」。只认汉字打头、括号里全是假名的。 */
    static String bracketize(String text) {
        return FuriganaNotation.bracketize(text);
    }

    /** 去掉方括号记法，留下底字。 */
    static String strip(String annotated) {
        return FuriganaNotation.strip(annotated);
    }

    /** 空白差异不算改动 —— 模型常把换行变成空格，那个不伤内容。 */
    private static boolean sameText(String a, String b) {
        return WHITESPACE.matcher(a).replaceAll("").equals(WHITESPACE.matcher(b).replaceAll(""));
    }
}
