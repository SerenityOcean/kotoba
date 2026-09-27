package com.keshi.kotoba.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 整条登录链路走一遍：真的 Spring Security、真的 Spring Session JDBC、真的 Postgres
 * （和 KotobaApplicationTests 一样，要先 docker compose up 起本地库）。
 *
 * MockMvc 不会自动带 cookie，这里用 {@link Browser} 手动扮演一个浏览器：
 * 记住 SESSION 和 XSRF-TOKEN，写请求时把后者抄进请求头 —— 和前端 api.ts 做的一样。
 * 每个用例一个随机 IP，免得限流计数在用例之间串。
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowIntegrationTest {

    private static final String PASSWORD = "correct-horse-1";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private AuthMailer mailer;

    private String username;
    private String ip;

    @BeforeEach
    void setUp() {
        username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());
        ip = "10.%d.%d.%d".formatted(rnd(), rnd(), rnd());
        when(mailer.isEnabled()).thenReturn(true);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", username);
        jdbc.update("DELETE FROM app_user WHERE username = ?", username);
    }

    @Test
    @DisplayName("写请求不带 CSRF 令牌一律 403，连登录也是")
    void rejectsWritesWithoutCsrfToken() throws Exception {
        mvc.perform(post("/api/auth/login").with(r -> { r.setRemoteAddr(ip); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(username, PASSWORD)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("注册即登录，会话落在 spring_session 表里，登出后失效")
    void registerLoginLogout() throws Exception {
        Browser browser = new Browser();
        assertNotNull(browser.xsrf, "第一次请求就该下发 XSRF-TOKEN");
        browser.send(get("/api/auth/me")).andExpect(status().isUnauthorized());

        browser.send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(username, PASSWORD)))
                .andExpect(status().isCreated());
        browser.send(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username));

        Integer rows = jdbc.queryForObject(
                "SELECT count(*) FROM spring_session WHERE principal_name = ?", Integer.class, username);
        assertEquals(1, rows);

        browser.send(post("/api/auth/logout")).andExpect(status().isNoContent());
        browser.send(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("同一 IP 连错 5 次密码，第 6 次直接 429，连对的密码也不放")
    void locksOutAfterRepeatedFailures() throws Exception {
        register(new Browser());

        Browser attacker = new Browser();
        for (int i = 0; i < 5; i++) {
            attacker.send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(json(username, "wrong-password")))
                    .andExpect(status().isUnauthorized());
        }
        attacker.send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(username, PASSWORD)))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("设备列表能看到两台；退出其他设备后另一台失效，当前这台还在")
    void revokeOtherSessions() throws Exception {
        Browser laptop = new Browser();
        register(laptop);
        Browser phone = new Browser();
        login(phone, PASSWORD);

        laptop.send(get("/api/account/sessions"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].current").value(true));

        laptop.send(post("/api/account/sessions/revoke-others")).andExpect(status().isNoContent());

        phone.send(get("/api/auth/me")).andExpect(status().isUnauthorized());
        laptop.send(get("/api/auth/me")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("改密码要验旧密码；改完别的设备下线，旧密码作废")
    void changePassword() throws Exception {
        Browser laptop = new Browser();
        register(laptop);
        Browser phone = new Browser();
        login(phone, PASSWORD);

        laptop.send(post("/api/account/password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"nope-nope\",\"newPassword\":\"new-password-2\"}"))
                .andExpect(status().isBadRequest());
        laptop.send(post("/api/account/password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"new-password-2\"}"))
                .andExpect(status().isNoContent());

        laptop.send(get("/api/auth/me")).andExpect(status().isOk());
        phone.send(get("/api/auth/me")).andExpect(status().isUnauthorized());

        Browser fresh = new Browser();
        fresh.send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json(username, PASSWORD))).andExpect(status().isUnauthorized());
        login(fresh, "new-password-2");
    }

    @Test
    @DisplayName("绑邮箱 → 点验证链接 → 忘记密码 → 点重置链接：新密码能登，所有旧会话下线，链接只能用一次")
    void emailBindingAndPasswordReset() throws Exception {
        Browser browser = new Browser();
        register(browser);
        String email = username + "@example.com";

        browser.send(post("/api/account/email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email.toUpperCase() + "\",\"currentPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isAccepted());
        String verifyToken = tokenFromMail(email, "/verify-email");

        // 在另一台没登录的设备上点开链接
        Browser mailApp = new Browser();
        mailApp.send(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + verifyToken + "\"}"))
                .andExpect(status().isNoContent());
        browser.send(get("/api/account")).andExpect(jsonPath("$.email").value(email));

        Browser stranger = new Browser();
        stranger.send(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody-" + username + "@example.com\"}"))
                .andExpect(status().isAccepted());
        stranger.send(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isAccepted());
        String resetToken = tokenFromMail(email, "/reset-password");

        String confirm = "{\"token\":\"" + resetToken + "\",\"newPassword\":\"reset-password-3\"}";
        stranger.send(post("/api/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(confirm)).andExpect(status().isNoContent());
        stranger.send(post("/api/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(confirm)).andExpect(status().isBadRequest());

        browser.send(get("/api/auth/me")).andExpect(status().isUnauthorized());
        login(new Browser(), "reset-password-3");
    }

    @Test
    @DisplayName("GitHub 没配时 features 如实回 false，授权入口也不存在")
    void githubDisabledWithoutConfig() throws Exception {
        Browser browser = new Browser();
        browser.send(get("/api/auth/features"))
                .andExpect(jsonPath("$.github").value(false))
                .andExpect(jsonPath("$.email").value(true));
    }

    // ---- 工具 ---------------------------------------------------------------

    private void register(Browser browser) throws Exception {
        browser.send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(username, PASSWORD))).andExpect(status().isCreated());
    }

    private void login(Browser browser, String password) throws Exception {
        browser.send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json(username, password))).andExpect(status().isOk());
    }

    /** 从最近一封发给 to 的邮件正文里抠出令牌。 */
    private String tokenFromMail(String to, String path) {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailer, org.mockito.Mockito.atLeastOnce()).send(eq(to), anyString(), body.capture());
        String last = body.getAllValues().getLast();
        Matcher m = Pattern.compile(Pattern.quote(path) + "\\?token=([A-Za-z0-9_-]+)").matcher(last);
        if (!m.find()) {
            throw new AssertionError("邮件里没有 " + path + " 链接：\n" + last);
        }
        return m.group(1);
    }

    private static String json(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    }

    private static int rnd() {
        return ThreadLocalRandom.current().nextInt(1, 255);
    }

    /** 一个会记 cookie 的"浏览器"。 */
    private final class Browser {
        private String session;
        private String xsrf;
        private final String sessionHint = UUID.randomUUID().toString();

        /** 真前端启动时先问 /me，XSRF-TOKEN 就是那时拿到的；这里照做。 */
        Browser() throws Exception {
            send(get("/api/auth/features"));
        }

        org.springframework.test.web.servlet.ResultActions send(MockHttpServletRequestBuilder request)
                throws Exception {
            request.with(r -> {
                r.setRemoteAddr(ip);
                return r;
            }).header("User-Agent", "it-browser-" + sessionHint);
            if (session != null) {
                request.cookie(new Cookie("SESSION", session));
            }
            if (xsrf != null) {
                request.cookie(new Cookie("XSRF-TOKEN", xsrf)).header("X-XSRF-TOKEN", xsrf);
            }
            var result = mvc.perform(request);
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
