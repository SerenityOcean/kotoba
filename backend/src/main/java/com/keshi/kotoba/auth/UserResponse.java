package com.keshi.kotoba.auth;

/**
 * 返回给前端的当前用户。密码哈希永远不出这个包。
 * demo = 共用的体验账号，前端据此显示只读提示、不往后端存复习记录。
 */
public record UserResponse(Long id, String username, boolean demo) {

    public static UserResponse from(AppUserPrincipal principal, boolean demo) {
        return new UserResponse(principal.id(), principal.username(), demo);
    }
}
