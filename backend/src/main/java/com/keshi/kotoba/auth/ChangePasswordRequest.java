package com.keshi.kotoba.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** currentPassword 对没有密码的账号可以不填，其余情况由 {@link AccountService} 校验。 */
public record ChangePasswordRequest(

        String currentPassword,

        @NotBlank(message = "新密码不能为空")
        @Size(min = PasswordRules.MIN, max = PasswordRules.MAX, message = PasswordRules.MESSAGE)
        String newPassword
) {
}
