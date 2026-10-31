package com.keshi.kotoba.article;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 存和改用同一个形状：改的时候三样一起提交，没改的原样带回来。 */
public record ArticleRequest(

        @NotBlank(message = "标题不能为空")
        @Size(max = 200, message = "标题太长了")
        String title,

        @NotBlank(message = "正文不能为空")
        @Size(max = 50000, message = "正文太长了，一次最多 5 万字")
        String body,

        // 只收 http(s)：这个链接会原样放进 <a href>，javascript: 之类的点了会执行脚本。
        // React 19 自己也会拦，这里是第二道。留空可以
        @Size(max = 2000, message = "链接太长了")
        @Pattern(regexp = "\\s*(https?://\\S+)?\\s*", flags = Pattern.Flag.CASE_INSENSITIVE,
                message = "链接要以 http:// 或 https:// 开头")
        String sourceUrl,

        // 存到哪个集；空是未归档。改文章时带回原来的，不在这里挪集
        Long folderId
) {
}
