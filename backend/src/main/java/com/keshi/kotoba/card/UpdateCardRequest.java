package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 长度上限同 {@link CreateCardRequest}。 */
public record UpdateCardRequest(

        @NotBlank(message = "正面不能为空")
        @Size(max = CreateCardRequest.MAX_FRONT, message = "正面最长 " + CreateCardRequest.MAX_FRONT + " 字")
        String front,

        @Size(max = CreateCardRequest.MAX_BACK, message = "背面最长 " + CreateCardRequest.MAX_BACK + " 字")
        String back,

        /** 读音，几个读音用 ／ 隔开。留空就按正反面重新猜。 */
        @Size(max = 100, message = "读音最长 100 字")
        String reading
) {
}
