package com.keshi.kotoba.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HexFormat;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 共用的体验账号：免密登进同一个号，只能看不能改。
 * 和 {@link AuthFlowIntegrationTest} 一样走真的 Spring Security、Spring Session JDBC 和本地 Postgres。
 */
@SpringBootTest(properties = "demo.username=" + DemoAccountIntegrationTest.DEMO)
@AutoConfigureMockMvc
class DemoAccountIntegrationTest {

    static final String DEMO = "it_demo_account";
    private static final String DEMO_PASSWORD = "demo-password-1";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private AuthService authService;

    private String ip;
    private String other;

    @BeforeEach
    void setUp() {
        ip = "10.%d.%d.%d".formatted(rnd(), rnd(), rnd());
        other = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        authService.register(DEMO, DEMO_PASSWORD);
    }

    @AfterEach
    void cleanUp() {
        for (String username : new String[]{DEMO, other}) {
            jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", username);
            jdbc.update("DELETE FROM deck WHERE owner_id IN (SELECT id FROM app_user WHERE username = ?)", username);
            jdbc.update("DELETE FROM app_user WHERE username = ?", username);
        }
    }

    @Test
    @DisplayName("不要密码就登进体验账号，前端能认出它；会话只留一天")
    void signsInWithoutPassword() throws Exception {
        Browser browser = new Browser();
        browser.send(get("/api/auth/features")).andExpect(jsonPath("$.demo").value(true));

        browser.send(post("/api/auth/demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(DEMO))
                .andExpect(jsonPath("$.demo").value(true));
        browser.send(get("/api/auth/me"))
                .andExpect(jsonPath("$.username").value(DEMO))
                .andExpect(jsonPath("$.demo").value(true));

        Integer maxInactive = jdbc.queryForObject(
                "SELECT max_inactive_interval FROM spring_session WHERE principal_name = ?", Integer.class, DEMO);
        assertEquals(24 * 60 * 60, maxInactive);
    }

    @Test
    @DisplayName("能看：读接口照常回")
    void canRead() throws Exception {
        Browser browser = demo();
        browser.send(get("/api/cards")).andExpect(status().isOk());
        browser.send(get("/api/decks")).andExpect(status().isOk());
        browser.send(get("/api/articles")).andExpect(status().isOk());
        browser.send(get("/api/account")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("不能改：写接口一律 403，回的是那句提示")
    void cannotWrite() throws Exception {
        Browser browser = demo();
        browser.send(post("/api/decks").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(DemoGuardFilter.MESSAGE));
        browser.send(put("/api/goal").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        browser.send(delete("/api/cards/1")).andExpect(status().isForbidden());
        browser.send(post("/api/account/password").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        browser.send(post("/api/account/sessions/revoke-others")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("登录设备（会列出别的访客）和绑 GitHub 这两个 GET 也不给")
    void blocksSensitiveReads() throws Exception {
        Browser browser = demo();
        browser.send(get("/api/account/sessions")).andExpect(status().isForbidden());
        browser.send(get("/api/account/github/link")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("只算不存的注音照常能用，登出也照常")
    void allowsComputeAndLogout() throws Exception {
        Browser browser = demo();
        browser.send(post("/api/furigana").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"日本語\"}"))
                .andExpect(status().isOk());
        browser.send(post("/api/auth/logout")).andExpect(status().isNoContent());
        browser.send(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("用密码登进体验账号也一样只读 —— 认的是号，不是怎么登进来的")
    void readOnlyEvenWithPassword() throws Exception {
        Browser browser = new Browser();
        browser.send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(DEMO, DEMO_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demo").value(true));
        browser.send(post("/api/decks").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("别的账号不受影响")
    void othersCanWrite() throws Exception {
        Browser browser = new Browser();
        browser.send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(other, "correct-horse-1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.demo").value(false));
        browser.send(post("/api/decks").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isCreated());
    }

    private Browser demo() throws Exception {
        Browser browser = new Browser();
        browser.send(post("/api/auth/demo")).andExpect(status().isOk());
        return browser;
    }

    private static String json(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
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

        ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
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
