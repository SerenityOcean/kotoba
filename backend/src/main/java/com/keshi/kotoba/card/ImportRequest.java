package com.keshi.kotoba.card;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportRequest(

        // 上限从 500 提到 5000：Anki 包动辄上千条
        @NotNull
        @Size(min = 1, max = 5000, message = "一次最多导入 5000 张")
        @Valid
        List<CreateCardRequest> cards,

        /** 导入到哪个包。留空进默认包；包不存在就按这个名字新建。 */
        @Size(max = 60, message = "包名最长 60 个字符")
        String deckName
) {
}
