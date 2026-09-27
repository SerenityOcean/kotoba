package com.keshi.kotoba.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * GitHub 授权回来之后的收尾。Spring 此时放进会话的是一个 OAuth2User，
 * 而本站所有接口认的是 {@link AppUserPrincipal} —— 这里把它换掉。
 *
 * 两种来路：
 * <ul>
 *   <li>登录页点的"用 GitHub 登录" —— 找到/新建对应账号，登进去；</li>
 *   <li>账号页点的"绑定 GitHub" —— 会话里有 {@link #LINK_USER_ID}，挂到那个账号上。</li>
 * </ul>
 */
@Component
public class GithubLoginSuccessHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

    static final String LINK_USER_ID = "kotoba.linkGithubToUserId";

    private final GithubAccountService githubAccounts;
    private final SessionManager sessionManager;
    private final String baseUrl;

    public GithubLoginSuccessHandler(GithubAccountService githubAccounts,
                                     SessionManager sessionManager,
                                     @Value("${app.base-url}") String baseUrl) {
        this.githubAccounts = githubAccounts;
        this.sessionManager = sessionManager;
        this.baseUrl = baseUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User githubUser = (OAuth2User) authentication.getPrincipal();
        String githubId = String.valueOf(githubUser.getAttributes().get("id"));
        String githubLogin = String.valueOf(githubUser.getAttributes().get("login"));

        // 拿到身份就够了，GitHub 的 access token 我们用不上，别让它躺在会话表里
        new HttpSessionOAuth2AuthorizedClientRepository()
                .removeAuthorizedClient(GithubAccountService.PROVIDER, authentication, request, response);

        HttpSession session = request.getSession();
        Long linkTo = (Long) session.getAttribute(LINK_USER_ID);
        session.removeAttribute(LINK_USER_ID);

        AppUser user;
        String target;
        if (linkTo != null) {
            try {
                user = githubAccounts.link(linkTo, githubId, githubLogin);
                target = "/account?github=linked";
            } catch (AccountConflictException e) {
                // 绑定失败，当前会话里已经是 OAuth2User 了，得把原来那个人登回去
                user = githubAccounts.userById(linkTo);
                target = "/account?github=taken";
            }
        } else {
            user = githubAccounts.loginOrRegister(githubId, githubLogin);
            target = "/";
        }

        sessionManager.signIn(user.getId(), user.getUsername(), request, response);
        response.sendRedirect(baseUrl + target);
    }

    /** 用户在 GitHub 上点了取消、state 对不上之类。回登录页，带个标记让前端提示。 */
    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        org.springframework.security.core.AuthenticationException exception)
            throws IOException {
        HttpSession session = request.getSession(false);
        Long linkTo = session == null ? null : (Long) session.getAttribute(LINK_USER_ID);
        if (linkTo != null) {
            session.removeAttribute(LINK_USER_ID);
        }
        response.sendRedirect(baseUrl + (linkTo != null ? "/account?github=failed" : "/login?error=github"));
    }
}
