package com.keshi.kotoba.article;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateArticleRequest(

        @NotBlank(message = "标题不能为空")
        @Size(max = 200, message = "标题太长了")
        String title,

        @NotBlank(message = "正文不能为空")
        @Size(max = 50000, message = "正文太长了，一次最多 5 万字")
        String body,

        @Size(max = 2000, message = "链接太长了")
        String sourceUrl
) {
}
