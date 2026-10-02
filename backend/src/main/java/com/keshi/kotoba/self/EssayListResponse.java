package com.keshi.kotoba.self;

import java.util.List;

/**
 * @param total    一共写了多少条，页脚用
 * @param canWrite 当前看的人是不是主人 —— 是的话页面上才露出「写」的入口
 */
public record EssayListResponse(List<EssayResponse> essays, boolean hasMore, long total, boolean canWrite) {
}
