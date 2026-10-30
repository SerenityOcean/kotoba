package com.keshi.kotoba.card;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;

import java.util.HexFormat;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 卡片自带的录音：导入后按 id 传上来，复习时放。走真的 Spring Security、会话和本地 Postgres
 * （要先 docker compose up 起本地库）。配额调成 1 MB，好测超额。
 */
@SpringBootTest(properties = "card.audio.quota-mb=1")
@AutoConfigureMockMvc
class CardAudioIntegrationTest {

    private static final byte[] MP3 = {(byte) 0xFF, (byte) 0xFB, 0x10, 0x20, 0x30, 0x40};

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final String ip = "10.%d.%d.%d".formatted(rnd(), rnd(), rnd());
    private String me;
    private String other;

    @BeforeEach
    void setUp() {
        me = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        other = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
    }

    @AfterEach
    void cleanUp() {
        for (String username : new String[]{me, other}) {
            jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", username);
            jdbc.update("DELETE FROM user_card_state WHERE user_id IN (SELECT id FROM app_user WHERE username = ?)", username);
            jdbc.update("DELETE FROM card WHERE owner_id IN (SELECT id FROM app_user WHERE username = ?)", username);
            jdbc.update("DELETE FROM deck WHERE owner_id IN (SELECT id FROM app_user WHERE username = ?)", username);
            jdbc.update("DELETE FROM app_user WHERE username = ?", username);
        }
    }

    @Test
    @DisplayName("导入回每张卡的 id，按 id 传上录音，复习时原样放出来，卡片上标着有")
    void uploadsAndPlays() throws Exception {
        Browser browser = signUp(me);
        long id = importCard(browser, "学校");

        browser.send(multipart("/api/cards/audio")
                        .file(new MockMultipartFile(id + ".word", "gakkou.mp3", "audio/mpeg", MP3))
                        .file(new MockMultipartFile(id + ".sentence", "rei.mp3", "audio/mpeg", new byte[]{1, 2, 3})))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stored").value(2));

        MockHttpServletResponse played = browser.send(get("/api/cards/" + id + "/audio/word"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "audio/mpeg"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=604800, private"))
                .andReturn().getResponse();
        assertArrayEquals(MP3, played.getContentAsByteArray());

        browser.send(get("/api/cards"))
                .andExpect(jsonPath("$[0].wordAudio").value(true))
                .andExpect(jsonPath("$[0].sentenceAudio").value(true));
    }

    @Test
    @DisplayName("支持 Range：Safari 先要前两个字节，不回 206 它就不放")
    void servesRanges() throws Exception {
        Browser browser = signUp(me);
        long id = importCard(browser, "学校");
        upload(browser, id + ".word", "audio/mpeg", MP3).andExpect(status().isOk());

        MockHttpServletResponse part = browser.send(get("/api/cards/" + id + "/audio/word")
                        .header(HttpHeaders.RANGE, "bytes=0-1"))
                .andExpect(status().isPartialContent())
                .andReturn().getResponse();
        assertArrayEquals(new byte[]{(byte) 0xFF, (byte) 0xFB}, part.getContentAsByteArray());
    }

    @Test
    @DisplayName("别人的卡：听不到，也传不上去")
    void staysPrivate() throws Exception {
        Browser mine = signUp(me);
        long id = importCard(mine, "学校");
        upload(mine, id + ".word", "audio/mpeg", MP3).andExpect(status().isOk());

        Browser theirs = signUp(other);
        theirs.send(get("/api/cards/" + id + "/audio/word")).andExpect(status().isNotFound());
        upload(theirs, id + ".sentence", "audio/mpeg", MP3).andExpect(status().isNotFound());
        assertEquals(1, audioCount(id));
    }

    @Test
    @DisplayName("不是录音的不收：网页、错的字段名、空文件")
    void rejectsNonAudio() throws Exception {
        Browser browser = signUp(me);
        long id = importCard(browser, "学校");

        upload(browser, id + ".word", "text/html", "<script>".getBytes())
                .andExpect(status().isBadRequest());
        upload(browser, id + ".picture", "audio/mpeg", MP3).andExpect(status().isBadRequest());
        upload(browser, "word", "audio/mpeg", MP3).andExpect(status().isBadRequest());
        upload(browser, id + ".word", "audio/mpeg", new byte[0]).andExpect(status().isBadRequest());
        assertEquals(0, audioCount(id));
    }

    @Test
    @DisplayName("超过配额就不收；换同一段不算两份")
    void enforcesQuota() throws Exception {
        Browser browser = signUp(me);
        long first = importCard(browser, "学校");
        long second = importCard(browser, "先生");
        byte[] big = new byte[700 * 1024];

        upload(browser, first + ".word", "audio/mpeg", big).andExpect(status().isOk());
        upload(browser, first + ".word", "audio/mpeg", big).andExpect(status().isOk());
        upload(browser, second + ".word", "audio/mpeg", big)
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message").value("录音空间用完了（每人 1 MB）"));
        assertEquals(0, audioCount(second));
    }

    @Test
    @DisplayName("重新导入同一个牌组：已有的卡也回 id，录音能补上；删卡录音跟着删")
    void reimportAndDelete() throws Exception {
        Browser browser = signUp(me);
        long id = importCard(browser, "学校");
        assertEquals(id, importCard(browser, "学校"), "已有的卡回原来的 id");

        upload(browser, id + ".word", "audio/mpeg", MP3).andExpect(status().isOk());
        browser.send(delete("/api/cards/" + id)).andExpect(status().isNoContent());
        assertEquals(0, audioCount(id));
    }

    private Browser signUp(String username) throws Exception {
        Browser browser = new Browser();
        browser.send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"correct-horse-1\"}"))
                .andExpect(status().isCreated());
        return browser;
    }

    /** 往「录音测试」包里导一张卡，回它的 id。 */
    private long importCard(Browser browser, String front) throws Exception {
        String body = browser.send(post("/api/cards/import").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deckName\":\"录音测试\",\"cards\":[{\"front\":\"" + front + "\",\"back\":\"x\"}]}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.cardIds['" + front + "']")).longValue();
    }

    private ResultActions upload(Browser browser, String name, String type, byte[] data) throws Exception {
        return browser.send(multipart("/api/cards/audio")
                .file(new MockMultipartFile(name, "a", type, data)));
    }

    private int audioCount(long cardId) {
        return jdbc.queryForObject("SELECT count(*) FROM card_audio WHERE card_id = ?", Integer.class, cardId);
    }

    private static int rnd() {
        return ThreadLocalRandom.current().nextInt(1, 255);
    }

    /** 记 cookie 的"浏览器"，和 AuthFlowIntegrationTest 里那个一样。 */
    private final class Browser {
        private String session;
        private String xsrf;

        Browser() throws Exception {
            send(get("/api/auth/features"));
        }

        ResultActions send(AbstractMockHttpServletRequestBuilder<?> request) throws Exception {
            request.with(r -> {
                r.setRemoteAddr(ip);
                return r;
            });
            if (session != null) {
                request.cookie(new Cookie("SESSION", session));
            }
            if (xsrf != null) {
                request.cookie(new Cookie("XSRF-TOKEN", xsrf)).header("X-XSRF-TOKEN", xsrf);
            }
            ResultActions result = mvc.perform(request);
            remember(result.andReturn().getResponse());
            return result;
        }

        private void remember(MockHttpServletResponse response) {
            Cookie s = response.getCookie("SESSION");
            if (s != null) {
                session = s.getMaxAge() == 0 ? null : s.getValue();
            }
            Cookie x = response.getCookie("XSRF-TOKEN");
            if (x != null) {
                xsrf = x.getMaxAge() == 0 ? null : x.getValue();
            }
        }
    }
}
