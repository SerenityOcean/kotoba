package com.keshi.kotoba.auth;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppUserDetailsService implements UserDetailsService {

    private final AppUserRepository users;

    public AppUserDetailsService(AppUserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return users.findByUsername(username)
                .map(AppUserPrincipal::of)
                // 占位账号（password_hash = 'NOT_SET'）能查到，但 'NOT_SET' 不是合法
                // bcrypt 串，密码比对必然失败 —— 得先走 /api/auth/register 认领。
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在：" + username));
    }
}
