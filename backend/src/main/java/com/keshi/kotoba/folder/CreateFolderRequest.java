package com.keshi.kotoba.folder;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateFolderRequest(

        @NotNull(message = "要说明是文章的集还是真题的集")
        Folder.Kind kind,

        @NotBlank(message = "集名不能为空")
        @Size(max = 60, message = "集名最长 60 个字符")
        String name
) {
}
