package com.keshi.kotoba.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final CurrentUser currentUser;

    private final SecurityContextRepository contextRepository =
            new HttpSessionSecurityContextRepository();

    public AuthController(AppUserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.currentUser = currentUser;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.UserResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已被占用");
        }
        AppUser user = new AppUser(
                request.username(),
                passwordEncoder.encode(request.password()),
                Instant.now());
        AppUser saved = userRepository.save(user);
        return new AuthDtos.UserResponse(saved.getId(), saved.getUsername());
    }

    @PostMapping("/login")
    public AuthDtos.UserResponse login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                       HttpServletRequest httpRequest,
                                       HttpServletResponse httpResponse) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (org.springframework.security.core.AuthenticationException e) {
            // 不区分"用户不存在"和"密码错误"——区分了就等于告诉攻击者哪些用户名存在
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }

        // 认证成功后必须显式存进 Session，否则下一个请求又是未登录状态
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, httpRequest, httpResponse);

        AppUser user = userRepository.findByUsername(authentication.getName()).orElseThrow();
        return new AuthDtos.UserResponse(user.getId(), user.getUsername());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();   // 服务器端删记录 = 立刻失效。这是 Session 相对 JWT 的优势
        }
        SecurityContextHolder.clearContext();
    }

    /** 前端启动时调一次，判断当前是否已登录。未登录时 SecurityConfig 会拦成 401。 */
    @GetMapping("/me")
    public AuthDtos.UserResponse me() {
        AppUser user = userRepository.findById(currentUser.id()).orElseThrow();
        return new AuthDtos.UserResponse(user.getId(), user.getUsername());
    }
}