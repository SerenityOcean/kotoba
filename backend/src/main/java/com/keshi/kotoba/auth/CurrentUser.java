package com.keshi.kotoba.auth;

/**
 * 临时接缝：当前所有数据都属于 V2 迁移脚本插入的那个用户。
 * 唯一职责是"以后从这里换成真的"。
 *
 * TODO(auth): M4-3 接入 Spring Security 后，改为
 *   SecurityContextHolder.getContext().getAuthentication()
 * 并删除这个类。
 */
public final class CurrentUser {

    /** V2 里 app_user 的 identity 从 1 开始，插入的第一行就是这个 id。 */
    private static final Long DEV_USER_ID = 1L;

    private CurrentUser() {
    }

    public static Long id() {
        return DEV_USER_ID;
    }
}