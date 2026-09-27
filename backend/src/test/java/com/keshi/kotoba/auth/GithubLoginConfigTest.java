package com.keshi.kotoba.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 配了 GITHUB_CLIENT_ID 之后：入口挂在 /api 下，回调地址按 APP_BASE_URL 拼。 */
@SpringBootTest(properties = {
        "auth.github.client-id=test-client",
        "auth.github.client-secret=test-secret",
        "app.base-url=https://kotoba.example"
})
@AutoConfigureMockMvc
class GithubLoginConfigTest {

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("features 报告 GitHub 可用")
    void featuresReportGithub() throws Exception {
        mvc.perform(get("/api/auth/features")).andExpect(jsonPath("$.github").value(true));
    }

    @Test
    @DisplayName("授权入口把人送去 GitHub，redirect_uri 是站点地址下的 /api 回调")
    void authorizationRedirectsToGithub() throws Exception {
        mvc.perform(get("/api/oauth2/authorization/github"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", allOf(
                        startsWith("https://github.com/login/oauth/authorize"),
                        containsString("client_id=test-client"),
                        containsString("redirect_uri=https://kotoba.example/api/login/oauth2/code/github"))));
    }

    @Test
    @DisplayName("没登录时访问绑定入口是 401，不是跳 GitHub")
    void linkRequiresLogin() throws Exception {
        mvc.perform(get("/api/account/github/link")).andExpect(status().isUnauthorized());
    }
}
