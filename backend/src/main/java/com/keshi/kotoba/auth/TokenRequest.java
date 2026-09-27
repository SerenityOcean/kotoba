package com.keshi.kotoba.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 邮件链接里的令牌。newPassword 只有重置密码时才有。 */
public record TokenRequest(

        @NotBlank(message = "链接不完整")
        String token,

        @Size(min = PasswordRules.MIN, max = PasswordRules.MAX, message = PasswordRules.MESSAGE)
        String newPassword
) {
}
