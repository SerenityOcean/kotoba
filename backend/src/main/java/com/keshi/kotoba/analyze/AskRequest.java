package com.keshi.kotoba.analyze;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AskRequest(

        @NotBlank(message = "请先选中要问的日语")
        @Size(max = 1500, message = "选中的这段太长了，最多 1500 字")
        String text,

        @NotBlank(message = "想问什么？")
        @Size(max = 500, message = "问题太长了，最多 500 字")
        String question,

        /** 选中那段的前后文，没有就不传 */
        @Size(max = 2000, message = "上下文太长了")
        String context,

        /** 就着同一段已经问过的，旧的在前。接着问时带上，模型才知道「再举个例子」指什么 */
        @Valid
        @Size(max = 8, message = "这一段问得够多了，重新选一下再问吧")
        List<Exchange> history
) {

    public record Exchange(

            @NotBlank(message = "之前的问题不能是空的")
            @Size(max = 500, message = "之前的问题太长了")
            String question,

            @NotBlank(message = "之前的回答不能是空的")
            @Size(max = 4000, message = "之前的回答太长了")
            String answer
    ) {
    }
}
