package com.keshi.kotoba.auth;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * 登录 / 注册 / 找回密码的频率限制。两层：
 *
 * <ul>
 *   <li>按 IP 限请求数 —— 挡住一个 IP 狂刷接口（撞库、批量注册、刷邮件）；</li>
 *   <li>按"用户名 + IP"限失败次数 —— 挡住对某个账号的密码爆破。</li>
 * </ul>
 *
 * 失败次数特意不只按用户名算：那样的话任何人输错 5 次 keshi 的密码，
 * keshi 本人就登不上了 —— 攻击者拿锁定当武器。
 */
@Component
public class LoginThrottle {

    private final RateLimiter loginPerIp;
    private final RateLimiter failuresPerAccount;
    private final RateLimiter registerPerIp;
    private final RateLimiter mailPerIp;

    public LoginThrottle(Clock clock) {
        this.loginPerIp = new RateLimiter(30, Duration.ofMinutes(10), clock);
        this.failuresPerAccount = new RateLimiter(5, Duration.ofMinutes(15), clock);
        this.registerPerIp = new RateLimiter(5, Duration.ofHours(1), clock);
        this.mailPerIp = new RateLimiter(5, Duration.ofHours(1), clock);
    }

    /** 登录（以及其他要验当前密码的操作）之前先过这一道。 */
    public void checkLogin(String ip, String username) {
        rejectIfBlocked(failuresPerAccount.blockedFor(accountKey(ip, username)));
        rejectIfBlocked(loginPerIp.tryAcquire(ip));
    }

    public void onLoginFailure(String ip, String username) {
        failuresPerAccount.hit(accountKey(ip, username));
    }

    public void onLoginSuccess(String ip, String username) {
        failuresPerAccount.reset(accountKey(ip, username));
    }

    public void checkRegister(String ip) {
        rejectIfBlocked(registerPerIp.tryAcquire(ip));
    }

    /** 会发邮件的接口：找回密码、绑定邮箱。 */
    public void checkMail(String ip) {
        rejectIfBlocked(mailPerIp.tryAcquire(ip));
    }

    private static String accountKey(String ip, String username) {
        return AuthService.normalize(username) + "|" + ip;
    }

    private static void rejectIfBlocked(Duration blockedFor) {
        if (blockedFor != null) {
            throw new TooManyAttemptsException(blockedFor);
        }
    }
}
