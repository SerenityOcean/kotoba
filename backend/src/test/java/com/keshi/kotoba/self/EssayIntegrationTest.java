package com.keshi.kotoba.self;

import com.keshi.kotoba.auth.AppUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 谁能读、谁能写：真的 Spring Security、真的 Postgres（要先 docker compose up 起本地库）。
 * 主人换成一个测试专用的用户名，免得和本地库里真的 keshi 搅在一起。
 */
@SpringBootTest(properties = "self.owner=" + EssayIntegrationTest.OWNER)
@AutoConfigureMockMvc
class EssayIntegrationTest {

    static final String OWNER = "it_self_owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<Long> created = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        created.forEach(id -> jdbc.update("DELETE FROM essay WHERE id = ?", id));
    }

    @Test
    @DisplayName("没登录也能读，但不给写的入口")
    void anyoneCanRead() throws Exception {
        mvc.perform(get("/api/self/essays"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canWrite").value(false));
    }

    @Test
    @DisplayName("没登录写不了")
    void anonymousCannotWrite() throws Exception {
        mvc.perform(post("/api/self/essays").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("偷偷写一条")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("登录了但不是主人：能读，写不了，也删不了")
    void otherUsersCannotWrite() throws Exception {
        long id = writeAsOwner("主人写的");

        mvc.perform(get("/api/self/essays").with(as("someone_else")))
                .andExpect(jsonPath("$.canWrite").value(false));
        mvc.perform(post("/api/self/essays").with(as("someone_else")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("我也想写")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("这里只有主人能写"));
        mvc.perform(delete("/api/self/essays/" + id).with(as("someone_else")).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("主人能写、能改、能删，读的时候看得到写的入口")
    void ownerWritesRevisesDeletes() throws Exception {
        long id = writeAsOwner("下班路上桂花开了。");

        mvc.perform(get("/api/self/essays").with(as(OWNER)))
                .andExpect(jsonPath("$.canWrite").value(true))
                .andExpect(jsonPath("$.essays[0].id").value(id))
                .andExpect(jsonPath("$.essays[0].body").value("下班路上桂花开了。"));

        mvc.perform(put("/api/self/essays/" + id).with(as(OWNER)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("下班路上桂花开了，很香。")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("下班路上桂花开了，很香。"))
                .andExpect(jsonPath("$.editedAt").isNotEmpty());

        mvc.perform(delete("/api/self/essays/" + id).with(as(OWNER)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/self/essays/" + id).with(as(OWNER)).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("空白内容落不了笔")
    void rejectsBlank() throws Exception {
        mvc.perform(post("/api/self/essays").with(as(OWNER)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("写点什么再落笔吧"));
    }

    private long writeAsOwner(String text) throws Exception {
        String response = mvc.perform(post("/api/self/essays").with(as(OWNER)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(text)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(response.replaceAll(".*\"id\":(\\d+).*", "$1"));
        created.add(id);
        return id;
    }

    private static RequestPostProcessor as(String username) {
        return user(AppUserPrincipal.forSession(-1L, username));
    }

    private static String body(String text) {
        return "{\"body\":\"" + text + "\"}";
    }
}
