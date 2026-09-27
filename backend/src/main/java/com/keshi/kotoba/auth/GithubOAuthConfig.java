package com.keshi.kotoba.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

/**
 * GitHub 登录。没配 GITHUB_CLIENT_ID 就不注册这个 bean，
 * SecurityConfig 看不到它就不开 oauth2Login，前端也就不显示那个按钮。
 *
 * 不用 Boot 的 spring.security.oauth2.client.registration.* 属性：
 * 那一套在 client-id 为空时直接启动失败，没法做成"没配就关掉"。
 */
@Configuration
public class GithubOAuthConfig {

    /**
     * OAuth 的两个端点都挂到 /api 下：nginx 只把 /api/ 转给后端，
     * 挂在 Spring 默认的 /oauth2、/login/oauth2 下就得再改 nginx 和 vite 的代理。
     */
    static final String AUTHORIZATION_BASE_URI = "/api/oauth2/authorization";
    static final String CALLBACK_BASE_URI = "/api/login/oauth2/code";

    @Bean
    @ConditionalOnExpression("!'${auth.github.client-id:}'.isBlank()")
    ClientRegistrationRepository githubClientRegistrations(
            @Value("${auth.github.client-id}") String clientId,
            @Value("${auth.github.client-secret}") String clientSecret,
            @Value("${app.base-url}") String baseUrl) {
        return new InMemoryClientRegistrationRepository(
                CommonOAuth2Provider.GITHUB.getBuilder(GithubAccountService.PROVIDER)
                        .clientId(clientId)
                        .clientSecret(clientSecret)
                        // 写死成站点地址，不从请求里推：开发时请求经过 vite 代理，
                        // 推出来的 host/端口不一定是用户浏览器里那个。
                        // GitHub OAuth App 里填的 callback URL 必须和它一字不差。
                        .redirectUri(baseUrl + CALLBACK_BASE_URI + "/{registrationId}")
                        .build());
    }
}
