package com.keshi.kotoba.auth;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;

import java.time.Clock;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http,
                                    SecurityContextRepository securityContextRepository,
                                    ObjectProvider<ClientRegistrationRepository> github,
                                    GithubLoginSuccessHandler githubHandler) throws Exception {
        http
                // 会话 cookie 是 SameSite=Lax（见 application.properties）：GitHub 授权回跳是
                // 从 github.com 过来的跨站导航，Strict 的话 cookie 带不回来，OAuth 的 state 就对不上。
                // Lax 放行了跨站的顶层 GET，所以 CSRF 令牌要打开：
                // spa() = 令牌放在 JS 可读的 XSRF-TOKEN cookie 里，前端写请求时抄进 X-XSRF-TOKEN 头。
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/password-reset/**",
                                "/api/auth/email/verify").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/features").permitAll()
                        // self 的随笔谁都能读；写还是要登录，是不是主人由 EssayController 再认
                        .requestMatchers(HttpMethod.GET, "/api/self/essays", "/api/self/essays/*").permitAll()
                        .requestMatchers(GithubOAuthConfig.AUTHORIZATION_BASE_URI + "/**",
                                GithubOAuthConfig.CALLBACK_BASE_URI + "/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        // 前端静态资源（生产里由 nginx 发）不归这儿管
                        .anyRequest().permitAll())
                // 没登录就干脆回 401，别重定向到登录页 —— 前端是 SPA，自己会跳
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                // 会话失效时 Spring Session 自己会把 SESSION cookie 清掉，不用 deleteCookies
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpStatus.NO_CONTENT.value())));

        if (github.getIfAvailable() != null) {
            http.oauth2Login(oauth -> oauth
                    .authorizationEndpoint(e -> e.baseUri(GithubOAuthConfig.AUTHORIZATION_BASE_URI))
                    .redirectionEndpoint(e -> e.baseUri(GithubOAuthConfig.CALLBACK_BASE_URI + "/*"))
                    .successHandler(githubHandler)
                    .failureHandler(githubHandler));
        }
        return http.build();
    }

    /** 会话存哪儿：HttpSession（背后是 Spring Session JDBC）。登录成功后要手动往这里写。 */
    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** 限流窗口、令牌过期都按它算；测试里换成固定时钟。 */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    AuthenticationManager authenticationManager(AppUserDetailsService userDetailsService,
                                                PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
}
