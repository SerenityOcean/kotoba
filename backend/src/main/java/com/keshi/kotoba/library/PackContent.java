package com.keshi.kotoba.library;

import com.keshi.kotoba.card.CreateCardRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 解锁时复制给用户的那部分：卡片进一个叫 deckName 的包，文章进阅读列表。
 * 形状和 demo/n5.json 一样（卡片背面沿用 Anki 词汇包的五行格式），那份素材可以直接拿来当第一个包。
 *
 * <p>文章正文存的时候就注好音（主人上传时后端跑一遍词典），导入只是原样复制。
 */
public record PackContent(

        @NotBlank(message = "要给卡包起个名字")
        @Size(max = 60, message = "包名最长 60 个字符")
        String deckName,

        @NotNull
        @Size(max = 5000, message = "一个包最多 5000 张卡")
        @Valid
        List<CreateCardRequest> cards,

        @NotNull
        @Size(max = 100, message = "一个包最多 100 篇文章")
        @Valid
        List<Article> articles
) {

    public record Article(

            @NotBlank(message = "文章标题不能为空")
            @Size(max = 200, message = "标题太长了")
            String title,

            @NotBlank(message = "文章正文不能为空")
            @Size(max = 50000, message = "正文太长了，一篇最多 5 万字")
            String body
    ) {
    }
}
