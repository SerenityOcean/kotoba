package com.keshi.kotoba.folder;

import java.time.Instant;
import java.util.List;

/**
 * 一类东西的全部集，连同每个集里有几个；没进任何集的单独数一个 unfiled。
 * 前端的选择条一次拿全，不用再按集一个个去问。
 */
public record FolderListing(List<Item> folders, long unfiled, long total) {

    public record Item(Long id, String name, long count, Instant createdAt) {
    }
}
