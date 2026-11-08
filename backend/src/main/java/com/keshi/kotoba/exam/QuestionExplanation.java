package com.keshi.kotoba.exam;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 一道题的解析，由模型按这几个 record 推出的 schema 写。
 * 和拆解一样，{@code @JsonPropertyDescription} 是提示词的一部分，提示词另一半在
 * {@link ExplanationService}。
 *
 * <p>例句挂在每个选项上，错误选项也有。之前存下的解析例句在最外层（只给正解造了一句），
 * 读的时候不认那两个字段，按「选项上没有例句」重新生成。
 *
 * <p>讲解要用中文写。模型偶尔整段写成日语，{@link #writtenInJapanese()} 认得出来，
 * 这种不存、也不当成已生成的给出去。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuestionExplanation(

        @JsonPropertyDescription("这题考什么，一句中文，例如「漢字読み：行事的读音」「文法：〜すぎて〜ない」「读解：笔者对○○的看法」")
        String point,

        @JsonPropertyDescription("为什么选正确答案，2–4 句，用中文写，日语只在「」里引用。读解题指出本文里哪一句是依据；"
                + "语法题讲接续和意思；词汇题讲词义和搭配")
        String reason,

        @JsonPropertyDescription("每个选项一项，按选项顺序，一个不漏")
        List<Choice> choices
) {

    /** 选项上没有例句字段：是每个选项都带例句之前生成的，要重新生成 */
    @JsonIgnore
    public boolean predatesChoiceExamples() {
        return choices != null && choices.stream().anyMatch(c -> c.example() == null);
    }

    /**
     * 引用以外的假名占到这么多，就是写成日语了。拿线上存下的 105 份解析量过：
     * 中文的讲解 reason 最高 0.13，写成日语的两份 0.65、0.66。
     */
    static final double JAPANESE_SHARE = 0.3;

    /** 「」『』和括号、引号里的是引用的日语或注的读音，不算 */
    private static final Pattern QUOTED =
            Pattern.compile("「[^」]*」|『[^』]*』|（[^）]*）|\\([^)]*\\)|\"[^\"]*\"|“[^”]*”");

    /**
     * 讲解写成日语了吗：reason 单看，或者整份合起来看，引用以外的假名占汉字加假名的三成以上。
     * 选项的 meaning 单看不作数 —— 读音题的选项本身就是假名，一句里假名多是正常的。
     */
    @JsonIgnore
    public boolean writtenInJapanese() {
        StringBuilder all = new StringBuilder();
        all.append(point).append('\n').append(reason);
        if (choices != null) {
            for (Choice choice : choices) {
                all.append('\n').append(choice.meaning()).append('\n').append(choice.verdict());
            }
        }
        return kanaShare(reason) >= JAPANESE_SHARE || kanaShare(all.toString()) >= JAPANESE_SHARE;
    }

    /** 引用以外，假名占汉字加假名的比例。字太少（不到 10 个）看不出来，算 0 */
    static double kanaShare(String text) {
        if (text == null) {
            return 0;
        }
        String plain = QUOTED.matcher(text).replaceAll("");
        int kana = 0;
        int han = 0;
        for (int i = 0; i < plain.length(); i++) {
            char c = plain.charAt(i);
            if (c >= '\u3040' && c <= '\u30FF' && c != 'ー' && c != '・') {
                kana++;
            } else if (c >= '\u4E00' && c <= '\u9FFF') {
                han++;
            }
        }
        return kana + han < 10 ? 0 : (double) kana / (kana + han);
    }

    public record Choice(

            @JsonPropertyDescription("选项序号，从 1 数")
            int number,

            @JsonPropertyDescription("这个选项本身是什么意思，用中文写。读音选项：对应哪个词（写出汉字和中文意思），"
                    + "或者说明根本没有这个读法；词语、语法选项：读音、中文意思、常见接续或搭配；"
                    + "读解题的句子选项：用中文概括它在说什么")
            String meaning,

            @JsonPropertyDescription("放进这道题为什么对、为什么不对，一两句，用中文写")
            String verdict,

            @JsonPropertyDescription("用这个选项的词或句型新造一个日语例句，一句，N2 难度，不要照搬题目原句，也不要注音。"
                    + "错误选项也要造：读音选项用它对应的那个词（写汉字）造句。"
                    + "选项不是真实存在的词或读法、或者是读解题的内容概括，造不出例句，写空串")
            String example,

            @JsonPropertyDescription("example 的中文翻译，自然通顺；example 是空串这里也写空串")
            String exampleTranslation
    ) {
    }
}
