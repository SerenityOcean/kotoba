package com.keshi.kotoba.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 换绑邮箱时要带当前密码；找回密码时只有 email，currentPassword 留空。 */
public record EmailRequest(

        @NotBlank(message = "邮箱不能为空")
        @Email(message = "邮箱格式不对")
        @Size(max = 254, message = "邮箱太长了")
        String email,

        String currentPassword
) {
}
