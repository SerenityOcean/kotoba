package com.keshi.kotoba.auth;

import jakarta.validation.constraints.NotBlank;

/** 登录不校验长度/字符 —— 那是注册时的规矩，这里只管比对。 */
public record LoginRequest(

        @NotBlank(message = "用户名不能为空")
        String username,

        @NotBlank(message = "密码不能为空")
        String password
) {
}
