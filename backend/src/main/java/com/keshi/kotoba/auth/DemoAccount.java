package com.keshi.kotoba.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 共用的体验账号：展示页上「用演示账号进去」登进来的就是它。谁点都是同一个号，
 * 所以它只能看不能改 —— 拦写请求的是 {@link DemoGuardFilter}。
 *
 * 号本身是 demo/seed.py 建的普通账号（卡包、分级阅读、备考目标），这里只认用户名。
 * 没配（DEMO_USERNAME 为空）就不开：/api/auth/demo 回 404，展示页上也不显示那个按钮。
 */
@Component
public class DemoAccount {

    private final String username;

    public DemoAccount(@Value("${demo.username:}") String username) {
        this.username = username.isBlank() ? "" : AuthService.normalize(username);
    }

    public boolean enabled() {
        return !username.isEmpty();
    }

    public String username() {
        return username;
    }

    public boolean is(String username) {
        return enabled() && this.username.equals(username);
    }
}
