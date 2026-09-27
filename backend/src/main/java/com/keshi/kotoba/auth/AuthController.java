package com.keshi.kotoba.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 不需要登录的那一半：登录、注册、找回密码、点邮件链接。
 * 登出不在这儿 —— 由 Spring Security 的 LogoutFilter 处理 POST /api/auth/logout
 * （见 {@link SecurityConfig}）。登录之后的账号管理在 {@link AccountController}。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AccountService accountService;
    private final AuthenticationManager authenticationManager;
    private final SessionManager sessionManager;
    private final LoginThrottle throttle;
    private final AuthMailer mailer;
    private final boolean githubEnabled;

    public AuthController(AuthService authService,
                          AccountService accountService,
                          AuthenticationManager authenticationManager,
                          SessionManager sessionManager,
                          LoginThrottle throttle,
                          AuthMailer mailer,
                          ObjectProvider<ClientRegistrationRepository> github) {
        this.authService = authService;
        this.accountService = accountService;
        this.authenticationManager = authenticationManager;
        this.sessionManager = sessionManager;
        this.throttle = throttle;
        this.mailer = mailer;
        this.githubEnabled = github.getIfAvailable() != null;
    }

    @GetMapping("/features")
    public FeaturesResponse features() {
        return new FeaturesResponse(mailer.isEnabled(), githubEnabled);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request,
                                 HttpServletRequest httpRequest,
                                 HttpServletResponse httpResponse) {
        throttle.checkRegister(httpRequest.getRemoteAddr());
        authService.register(request.username(), request.password());
        // 注册完直接登上，省得再让用户输一遍
        return login(request.username(), request.password(), httpRequest, httpResponse);
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        return login(request.username(), request.password(), httpRequest, httpResponse);
    }

    /** 前端启动时先问一句"我是谁"：没登录的话过不了 filter，直接 401。 */
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AppUserPrincipal principal) {
        return UserResponse.from(principal);
    }

    /** 无论邮箱存不存在都回 202，见 {@link AccountService#requestPasswordReset}。 */
    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestPasswordReset(@Valid @RequestBody EmailRequest request,
                                     HttpServletRequest httpRequest) {
        throttle.checkMail(httpRequest.getRemoteAddr());
        accountService.requestPasswordReset(request.email());
    }

    /** 重置成功后所有设备一律下线：既然要重置，多半是怀疑密码泄露了。 */
    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody TokenRequest request) {
        if (request.newPassword() == null) {
            throw new IllegalArgumentException("新密码不能为空");
        }
        String username = accountService.resetPassword(request.token(), request.newPassword());
        sessionManager.revokeAll(username);
    }

    /** 不要求登录：邮件可能是在手机上点开的，那边没登录。 */
    @PostMapping("/email/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody TokenRequest request) {
        accountService.verifyEmail(request.token());
    }

    private UserResponse login(String username, String password,
                               HttpServletRequest httpRequest,
                               HttpServletResponse httpResponse) {
        String ip = httpRequest.getRemoteAddr();
        throttle.checkLogin(ip, username);

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            AuthService.normalize(username), password));
        } catch (AuthenticationException e) {
            throttle.onLoginFailure(ip, username);
            throw e;
        }
        throttle.onLoginSuccess(ip, username);

        AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
        sessionManager.signIn(principal.id(), principal.username(), httpRequest, httpResponse);
        return UserResponse.from(principal);
    }
}
