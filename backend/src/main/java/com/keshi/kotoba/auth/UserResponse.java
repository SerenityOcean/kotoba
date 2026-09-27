package com.keshi.kotoba.auth;

/** 返回给前端的当前用户。密码哈希永远不出这个包。 */
public record UserResponse(Long id, String username) {

    public static UserResponse from(AppUserPrincipal principal) {
        return new UserResponse(principal.id(), principal.username());
    }
}
