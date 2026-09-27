package com.keshi.kotoba.auth;

/** 账号页要的全部信息。email / githubLogin 没绑就是 null。 */
public record AccountResponse(String username, String email, boolean hasPassword, String githubLogin) {
}
