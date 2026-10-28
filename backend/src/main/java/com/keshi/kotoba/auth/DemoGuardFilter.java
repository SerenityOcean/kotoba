package com.keshi.kotoba.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * 体验账号只读。大家共用一个号：谁删了卡别人都看得见，改密码、踢设备更是能把其他访客锁在外面。
 *
 * 放过的写请求只有不动数据的：/api/auth/**（登录、注册、登出，本来就不看你是谁），
 * 以及拆解和注音（只算不存；拆解另有体验号自己的每日额度，见 AnalyzeQuota）。
 * 另外拦两个 GET：「登录设备」会列出其他访客的 IP 和浏览器；「绑定 GitHub」会把访客
 * 自己的 GitHub 挂到共用号上，之后谁用那个 GitHub 登录都进的是体验号。
 *
 * 不做成 @Component：那样 Spring Boot 会把它再注册成一个普通 servlet filter，
 * 跑在 Spring Security 前面，那时还不知道是谁。只在 {@link SecurityConfig} 里挂进安全链。
 */
class DemoGuardFilter extends OncePerRequestFilter {

    static final String MESSAGE = "这是大家共用的体验账号，只能看不能改。注册一个，就能存自己的卡片和文章。";

    private static final Set<String> ALLOWED_WRITES = Set.of("/api/analyze", "/api/furigana");
    private static final Set<String> BLOCKED_READS = Set.of("/api/account/sessions", "/api/account/github/link");
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final DemoAccount demo;

    DemoGuardFilter(DemoAccount demo) {
        this.demo = demo;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (isDemo() && !allowed(request.getMethod(), request.getRequestURI().substring(request.getContextPath().length()))) {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            // 和 ApiError 同一个形状，前端照常把 message 显示出来
            response.getWriter().write("{\"message\":\"" + MESSAGE + "\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isDemo() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.getPrincipal() instanceof AppUserPrincipal principal
                && demo.is(principal.username());
    }

    static boolean allowed(String method, String path) {
        if (READ_METHODS.contains(method)) {
            return !BLOCKED_READS.contains(path);
        }
        return path.startsWith("/api/auth/") || ALLOWED_WRITES.contains(path);
    }
}
