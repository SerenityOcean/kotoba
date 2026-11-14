package com.keshi.kotoba.analyze;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReadingAssistServiceTest {

    @Test
    @DisplayName("没配 key 时翻译和提问都被明确拒掉")
    void withoutEngineBothAreRejected() {
        ReadingAssistService service = new ReadingAssistService(StubEngine.provide(null));

        assertThrows(AnalysisUnavailableException.class, () -> service.translate("勉強する", null));
        assertThrows(AnalysisUnavailableException.class, () -> service.ask("勉強する", "什么意思？", null, null));
    }

    @Test
    @DisplayName("翻译把选中的一段和上下文分开交给模型，译文两头的空白去掉")
    void translateSendsSelectionAndContext() {
        StubEngine engine = new StubEngine(new Translation(" 也能改变对方。\n"));
        ReadingAssistService service = new ReadingAssistService(StubEngine.provide(engine));

        Translation translation = service.translate(" 相手も変えられる ", "自分をコントロールできれば、相手も変えられる。");

        assertEquals("也能改变对方。", translation.translation());
        assertEquals("【选中的日语】\n相手も変えられる\n\n【上下文】\n自分をコントロールできれば、相手も変えられる。",
                engine.lastText);
        assertEquals(ReadingAssistService.TRANSLATE_PROMPT, engine.lastPrompt);
    }

    @Test
    @DisplayName("上下文就是选中的那段时不重复写一遍")
    void contextEqualToSelectionIsLeftOut() {
        StubEngine engine = new StubEngine(new Translation("学习"));
        new ReadingAssistService(StubEngine.provide(engine)).translate("勉強する", " 勉強する ");

        assertFalse(engine.lastText.contains("【上下文】"));
    }

    @Test
    @DisplayName("模型回了空译文算失败，不把空白当译文显示")
    void blankTranslationFails() {
        ReadingAssistService service =
                new ReadingAssistService(StubEngine.provide(new StubEngine(new Translation("  "))));

        assertThrows(AnalysisFailedException.class, () -> service.translate("勉強する", null));
    }

    @Test
    @DisplayName("接着问时之前的问答按顺序带上，现在的问题放最后")
    void askCarriesHistoryInOrder() {
        StubEngine engine = new StubEngine(new Answer("是可能形。"));
        ReadingAssistService service = new ReadingAssistService(StubEngine.provide(engine));

        Answer answer = service.ask("変えられる", " 再举个例句 ", null, List.of(
                new AskRequest.Exchange("这是可能还是被动？", "可能形。"),
                new AskRequest.Exchange("为什么？", "没有施事者。")));

        assertEquals("是可能形。", answer.answer());
        assertEquals("""
                【选中的日语】
                変えられる

                【之前的问答】
                问：这是可能还是被动？
                答：可能形。
                问：为什么？
                答：没有施事者。

                【现在的问题】
                再举个例句""", engine.lastText);
        assertTrue(engine.lastPrompt.contains("日语老师"));
    }

    @Test
    @DisplayName("头一回问时不写「之前的问答」")
    void firstQuestionHasNoHistorySection() {
        StubEngine engine = new StubEngine(new Answer("好"));
        new ReadingAssistService(StubEngine.provide(engine)).ask("変えられる", "什么意思？", "相手も変えられる。", List.of());

        assertEquals("【选中的日语】\n変えられる\n\n【上下文】\n相手も変えられる。\n\n【现在的问题】\n什么意思？",
                engine.lastText);
    }

    @Test
    @DisplayName("模型没回答算失败")
    void nullAnswerFails() {
        ReadingAssistService service =
                new ReadingAssistService(StubEngine.provide(new StubEngine(new Answer(null))));

        assertThrows(AnalysisFailedException.class, () -> service.ask("勉強する", "什么意思？", null, null));
    }
}
