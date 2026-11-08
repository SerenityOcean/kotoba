package com.keshi.kotoba.exam;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 认得出写成日语的解析。句子取自线上模型真写出来的几份。 */
class QuestionExplanationTest {

    private static QuestionExplanation.Choice choice(int number, String meaning, String verdict) {
        return new QuestionExplanation.Choice(number, meaning, verdict, "", "");
    }

    @Test
    @DisplayName("整份写成日语的认得出来")
    void detectsJapanese() {
        QuestionExplanation japanese = new QuestionExplanation(
                "文法：「〜こともある」の言い換えで、助詞「だって」が「〜も」の意味で使えるかを問う基礎文法問題。",
                "空所は「小説を読むこと（　）ある」で、前文を受けて「小説を読むこともある」という意味にしたい。"
                        + "ここでは「だって」が「も」と同じ意味で、「読むことだってある」となり文が成立する。",
                List.of(choice(2, "「だって」は取り立て助詞で、ここでは「も」と同じく「〜も」の意味を表す。",
                        "「たまには」と呼応して「時には〜することもある」という部分否定の例示になる。")));

        assertTrue(japanese.writtenInJapanese());
    }

    @Test
    @DisplayName("选项是中文、讲为什么选正解的那段是日语，也算写成日语")
    void detectsJapaneseReason() {
        QuestionExplanation mixed = new QuestionExplanation(
                "文法（副詞・呼応表現の选择）：文脈に合う副詞を選ぶ",
                "前件「健康にいい」と後件「ひざや腰を痛めてしまう」は、普通に考えれば逆の方向になっている。"
                        + "この「予想・期待とは逆の結果になる」ことを表す副詞は「かえって」しかない。",
                List.of(choice(2, "「せっかく」：好不容易、特意，常与「〜のに」「〜からには」等搭配，表示对努力白费或机会可惜的心情。",
                        "「せっかく」需要「好不容易做了某事却……」这种语境，本句没有这层意思，用进去意思不通。")));

        assertTrue(mixed.writtenInJapanese());
    }

    @Test
    @DisplayName("中文讲解里引用了很多日语、用了て形这类说法，不算日语")
    void acceptsChinese() {
        QuestionExplanation chinese = new QuestionExplanation(
                "文法：「初めてにしては」这类评价句里该用哪个副词",
                "句子结构是「初めてにしては（　　）上手だった」，后面是肯定评价「上手だった」，"
                        + "这里需要一个能修饰形容词、表示「程度相当高」的副词，所以选「なかなか」。"
                        + "「湿って」是动词「湿（しめ）る」的て形。",
                List.of(choice(2, "まさか（难道、不会吧），表示强烈的怀疑，后面多接否定或推量、疑问的表达。",
                        "它表达说话人的惊讶与不信，与「初めてにしては」的客观评价不搭配。"),
                        // 读音题的选项本身就是假名
                        choice(3, "しめって", "正确。")));

        assertFalse(chinese.writtenInJapanese());
    }

    @Test
    @DisplayName("引用和括号里的不算；字太少看不出来，算 0")
    void countsOnlyUnquotedText() {
        assertEquals(0, QuestionExplanation.kanaShare("「小説を読むこともある」（しょうせつ）是正确答案的意思"));
        assertEquals(0, QuestionExplanation.kanaShare("ことだってある"));
        assertEquals(0, QuestionExplanation.kanaShare(null));
    }
}
