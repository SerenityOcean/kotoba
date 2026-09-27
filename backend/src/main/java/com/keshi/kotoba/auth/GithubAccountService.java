package com.keshi.kotoba.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

/** GitHub 身份和本站账号之间的对应：登录时找人/建号，账号页里绑定/解绑。 */
@Service
public class GithubAccountService {

    static final String PROVIDER = "github";

    private final OAuthIdentityRepository identities;
    private final AppUserRepository users;
    private final AuthService authService;
    private final Clock clock;

    public GithubAccountService(OAuthIdentityRepository identities, AppUserRepository users,
                                AuthService authService, Clock clock) {
        this.identities = identities;
        this.users = users;
        this.authService = authService;
        this.clock = clock;
    }

    /**
     * 用 GitHub 登录：绑过的直接认出来；没绑过的新建一个没有密码的账号。
     *
     * 不按"邮箱相同"自动并到已有账号上 —— 那样的话谁控制了一个同邮箱的 GitHub 号，
     * 谁就能登进别人的账号。想把 GitHub 挂到老账号上，先用密码登录，再去账号页绑定。
     */
    @Transactional
    public AppUser loginOrRegister(String githubId, String githubLogin) {
        Optional<OAuthIdentity> existing = identities.findByProviderAndProviderUserId(PROVIDER, githubId);
        if (existing.isPresent()) {
            OAuthIdentity identity = existing.get();
            identity.updateLogin(githubLogin);
            return users.findById(identity.getUserId()).orElseThrow();
        }

        AppUser user = authService.registerWithoutPassword(githubLogin);
        identities.save(new OAuthIdentity(user.getId(), PROVIDER, githubId, githubLogin, Instant.now(clock)));
        return user;
    }

    @Transactional
    public AppUser link(Long userId, String githubId, String githubLogin) {
        Optional<OAuthIdentity> byGithub = identities.findByProviderAndProviderUserId(PROVIDER, githubId);
        if (byGithub.isPresent()) {
            if (!byGithub.get().getUserId().equals(userId)) {
                throw new AccountConflictException("这个 GitHub 账号已经绑定了别的用户");
            }
            byGithub.get().updateLogin(githubLogin);
        } else {
            if (identities.findByUserIdAndProvider(userId, PROVIDER).isPresent()) {
                throw new AccountConflictException("已经绑定了另一个 GitHub 账号，先解绑再绑新的");
            }
            identities.save(new OAuthIdentity(userId, PROVIDER, githubId, githubLogin, Instant.now(clock)));
        }
        return users.findById(userId).orElseThrow();
    }

    /** 解绑前确认还有别的路能登进来，免得把自己锁在门外。 */
    @Transactional
    public void unlink(Long userId) {
        AppUser user = users.findById(userId).orElseThrow();
        if (!user.hasPassword()) {
            throw new AccountConflictException("这个账号还没有密码，解绑之后就登不进来了。先设置一个密码");
        }
        identities.findByUserIdAndProvider(userId, PROVIDER).ifPresent(identities::delete);
    }

    public AppUser userById(Long userId) {
        return users.findById(userId).orElseThrow();
    }

    public Optional<String> linkedLogin(Long userId) {
        return identities.findByUserIdAndProvider(userId, PROVIDER).map(OAuthIdentity::getProviderLogin);
    }
}
