package com.keshi.kotoba.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

/** 登录之后的账号管理：密码、邮箱、GitHub、登录设备。 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final AccountService accountService;
    private final GithubAccountService githubAccountService;
    private final SessionManager sessionManager;
    private final LoginThrottle throttle;

    public AccountController(AccountService accountService,
                             GithubAccountService githubAccountService,
                             SessionManager sessionManager,
                             LoginThrottle throttle) {
        this.accountService = accountService;
        this.githubAccountService = githubAccountService;
        this.sessionManager = sessionManager;
        this.throttle = throttle;
    }

    @GetMapping
    public AccountResponse view(@AuthenticationPrincipal AppUserPrincipal user) {
        return accountService.view(user.id());
    }

    /**
     * 改完密码，别的设备全部下线，当前这台换一个 session id 接着用。
     * 验当前密码和登录共用一套失败计数 —— 偷到会话的人也别想在这儿爆破密码。
     */
    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AppUserPrincipal user,
                               @Valid @RequestBody ChangePasswordRequest request,
                               HttpServletRequest httpRequest) {
        withPasswordCheck(user, httpRequest, () ->
                accountService.changePassword(user.id(), request.currentPassword(), request.newPassword()));
        // 顺序不能反：changeSessionId 之后新 id 要到请求结束才写进库，
        // 先换 id 再按 id 排除"当前会话"，会把自己也当成"其他设备"踢掉
        sessionManager.revokeOthers(user.username(), httpRequest.getSession().getId());
        httpRequest.changeSessionId();
    }

    /** 发验证邮件。点了邮件里的链接才算绑上，见 {@link AuthController#verifyEmail}。 */
    @PostMapping("/email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestEmailChange(@AuthenticationPrincipal AppUserPrincipal user,
                                   @Valid @RequestBody EmailRequest request,
                                   HttpServletRequest httpRequest) {
        throttle.checkMail(httpRequest.getRemoteAddr());
        withPasswordCheck(user, httpRequest, () ->
                accountService.requestEmailChange(user.id(), request.currentPassword(), request.email()));
    }

    @DeleteMapping("/email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeEmail(@AuthenticationPrincipal AppUserPrincipal user) {
        accountService.removeEmail(user.id());
    }

    @GetMapping("/sessions")
    public List<SessionView> sessions(@AuthenticationPrincipal AppUserPrincipal user,
                                      HttpSession session) {
        return sessionManager.list(user.username(), session.getId());
    }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSession(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable String id) {
        if (!sessionManager.revoke(user.username(), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping("/sessions/revoke-others")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeOtherSessions(@AuthenticationPrincipal AppUserPrincipal user,
                                    HttpSession session) {
        sessionManager.revokeOthers(user.username(), session.getId());
    }

    /**
     * 绑定 GitHub：在会话里记一笔"接下来这次 GitHub 回调是来绑定的"，然后跳去授权。
     * 回来之后由 {@link GithubLoginSuccessHandler} 看这一笔决定是绑定还是登录。
     *
     * 用 GET 是因为要整页跳转。它的副作用只是往自己的会话里写个标记，
     * 被别的网站诱导着点了，结果也只是把你自己的 GitHub 绑给你自己。
     */
    @GetMapping("/github/link")
    public void linkGithub(@AuthenticationPrincipal AppUserPrincipal user,
                           HttpSession session,
                           HttpServletResponse response) throws IOException {
        session.setAttribute(GithubLoginSuccessHandler.LINK_USER_ID, user.id());
        response.sendRedirect(GithubOAuthConfig.AUTHORIZATION_BASE_URI + "/" + GithubAccountService.PROVIDER);
    }

    @DeleteMapping("/github")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlinkGithub(@AuthenticationPrincipal AppUserPrincipal user) {
        githubAccountService.unlink(user.id());
    }

    private void withPasswordCheck(AppUserPrincipal user, HttpServletRequest request, Runnable action) {
        String ip = request.getRemoteAddr();
        throttle.checkLogin(ip, user.username());
        try {
            action.run();
        } catch (WrongPasswordException e) {
            throttle.onLoginFailure(ip, user.username());
            throw e;
        }
        throttle.onLoginSuccess(ip, user.username());
    }
}
