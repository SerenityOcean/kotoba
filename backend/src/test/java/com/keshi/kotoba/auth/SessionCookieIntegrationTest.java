package com.keshi.kotoba.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 会话 cookie 得带有效期。不带就是"会话 cookie"：桌面 Chrome 会恢复所以看不出来，
 * 手机 Safari 一被系统回收就丢，每次打开都要重登。
 *
 * 要起真端口：cookie 的属性（Max-Age、HttpOnly、SameSite）是 Boot 按
 * server.servlet.session.cookie.* 配给 Spring Session 的，MockMvc 那套 mock 环境里不生效，
 * 在那儿断言什么都看不出来。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SessionCookieIntegrationTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    private final String username = "it_" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt());

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", username);
        jdbc.update("DELETE FROM app_user WHERE username = ?", username);
    }

    @Test
    @DisplayName("登录拿到的 SESSION cookie 带长有效期，关了浏览器也还在")
    void sessionCookieOutlivesTheBrowser() throws Exception {
        CookieManager jar = new CookieManager();
        HttpClient http = HttpClient.newBuilder().cookieHandler(jar).build();

        http.send(HttpRequest.newBuilder(url("/api/auth/features")).build(), HttpResponse.BodyHandlers.discarding());
        String xsrf = jar.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals("XSRF-TOKEN")).findFirst().map(HttpCookie::getValue).orElseThrow();

        HttpResponse<Void> registered = http.send(HttpRequest.newBuilder(url("/api/auth/register"))
                        .header("Content-Type", "application/json")
                        .header("X-XSRF-TOKEN", xsrf)
                        .POST(HttpRequest.BodyPublishers.ofString(
                                "{\"username\":\"" + username + "\",\"password\":\"correct-horse-1\"}"))
                        .build(),
                HttpResponse.BodyHandlers.discarding());
        assertEquals(201, registered.statusCode());

        String setCookie = registered.headers().allValues("Set-Cookie").stream()
                .filter(h -> h.startsWith("SESSION=")).findFirst().orElseThrow();
        HttpCookie session = HttpCookie.parse(setCookie).getFirst();
        // 至少要盖过服务端的 30 天闲置期限，否则 cookie 比会话先没
        assertTrue(session.getMaxAge() >= Duration.ofDays(30).toSeconds(),
                "SESSION 应带长有效期，实际：" + setCookie);
        assertTrue(session.isHttpOnly(), "SESSION 应是 HttpOnly，实际：" + setCookie);
    }

    private URI url(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
