package com.keshi.kotoba.folder;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 改名用。 */
public record FolderRequest(

        @NotBlank(message = "集名不能为空")
        @Size(max = 60, message = "集名最长 60 个字符")
        String name
) {
}
