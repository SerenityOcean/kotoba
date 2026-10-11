package com.keshi.kotoba.card;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 长度上限不只是防滥用：正面在 (deck_id, front) 上有唯一索引，PostgreSQL 的索引条目
 * 有大小上限，太长的正面会直接让插入报 500。500 字（UTF-8 最多 1500 字节）离那条线很远，
 * 例句卡也够用。
 */
public record CreateCardRequest(

        @NotBlank(message = "正面不能为空")
        @Size(max = CreateCardRequest.MAX_FRONT, message = "正面最长 " + CreateCardRequest.MAX_FRONT + " 字")
        String front,

        @Size(max = CreateCardRequest.MAX_BACK, message = "背面最长 " + CreateCardRequest.MAX_BACK + " 字")
        String back
) {
    static final int MAX_FRONT = 500;
    static final int MAX_BACK = 5000;
}
