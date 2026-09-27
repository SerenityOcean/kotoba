package com.keshi.kotoba.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

/**
 * 会话的进与出：把人登进当前会话，按用户列出/踢掉会话。
 *
 * 能按用户查会话，靠的是 Spring Session JDBC 在 spring_session.principal_name
 * 上建的索引 —— 以前 session 在 Tomcat 内存里，没法做"登出其他设备"。
 */
@Component
public class SessionManager {

    static final String USER_AGENT = "kotoba.userAgent";
    static final String IP = "kotoba.ip";

    private final SecurityContextRepository securityContextRepository;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    public SessionManager(SecurityContextRepository securityContextRepository,
                          FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.securityContextRepository = securityContextRepository;
        this.sessions = sessions;
    }

    /** 密码登录和 GitHub 登录最后都走这儿。 */
    public void signIn(Long userId, String username,
                       HttpServletRequest request, HttpServletResponse response) {
        // 防会话固定：登录前若已有 session（可能是别人塞给浏览器的），换个新 id 再往里写身份
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }

        AppUserPrincipal principal = AppUserPrincipal.forSession(userId, username);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities()));
        SecurityContextHolder.setContext(context);
        // 手动认证必须自己存，否则这次请求认了、下次请求又不认识了
        securityContextRepository.saveContext(context, request, response);

        HttpSession session = request.getSession();
        session.setAttribute(USER_AGENT, truncate(request.getHeader("User-Agent"), 300));
        session.setAttribute(IP, request.getRemoteAddr());
    }

    public List<SessionView> list(String username, String currentSessionId) {
        return sessions.findByPrincipalName(username).values().stream()
                .map(s -> new SessionView(
                        handle(s.getId()),
                        s.getCreationTime(),
                        s.getLastAccessedTime(),
                        s.getAttribute(USER_AGENT),
                        s.getAttribute(IP),
                        s.getId().equals(currentSessionId)))
                .sorted(Comparator.comparing(SessionView::current).reversed()
                        .thenComparing(SessionView::lastAccessedAt, Comparator.reverseOrder()))
                .toList();
    }

    /** 按 {@link SessionView#id()} 踢掉一个。只在这个用户自己的会话里找，找不到返回 false。 */
    public boolean revoke(String username, String handle) {
        return sessions.findByPrincipalName(username).keySet().stream()
                .filter(id -> handle(id).equals(handle))
                .findFirst()
                .map(id -> {
                    sessions.deleteById(id);
                    return true;
                })
                .orElse(false);
    }

    /** 除了当前这个，全踢。currentSessionId 传 null 就是一个不留。 */
    public int revokeOthers(String username, String currentSessionId) {
        List<String> ids = sessions.findByPrincipalName(username).keySet().stream()
                .filter(id -> !id.equals(currentSessionId))
                .toList();
        ids.forEach(sessions::deleteById);
        return ids.size();
    }

    public int revokeAll(String username) {
        return revokeOthers(username, null);
    }

    static String handle(String sessionId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(sessionId.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
