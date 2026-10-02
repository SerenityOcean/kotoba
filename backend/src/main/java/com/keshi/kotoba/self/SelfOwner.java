package com.keshi.kotoba.self;

import com.keshi.kotoba.auth.AppUserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * self 是一个人的随笔：谁都能读，只有配置里的那个用户名能写。
 * 现在还没有角色体系，为这一处加角色不值当，按用户名认就够了。
 * 配成空字符串就谁都写不了。
 */
@Component
public class SelfOwner {

    private final String username;

    public SelfOwner(@Value("${self.owner:}") String username) {
        this.username = username.strip();
    }

    /** user 为空表示没登录。 */
    public boolean is(AppUserPrincipal user) {
        return user != null && !username.isEmpty() && username.equals(user.username());
    }

    public void check(AppUserPrincipal user) {
        if (!is(user)) {
            throw new NotOwnerException();
        }
    }
}
