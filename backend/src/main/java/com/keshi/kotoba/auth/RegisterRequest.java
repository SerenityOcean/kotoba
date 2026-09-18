package com.keshi.kotoba.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @NotBlank(message = "用户名不能为空")
        @Size(min = 2, max = 32, message = "用户名长度需在 2 到 32 之间")
        @Pattern(regexp = "[A-Za-z0-9_-]*", message = "用户名只能包含字母、数字、下划线和减号")
        String username,

        // 上限 72 是 bcrypt 的硬限制，再长的部分会被悄悄截掉
        @NotBlank(message = "密码不能为空")
        @Size(min = 8, max = 72, message = "密码长度需在 8 到 72 之间")
        String password
) {
}
