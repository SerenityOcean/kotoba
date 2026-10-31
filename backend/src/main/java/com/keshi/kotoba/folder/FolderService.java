package com.keshi.kotoba.folder;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class FolderService {

    private final FolderRepository folders;
    private final NamedParameterJdbcTemplate jdbc;

    public FolderService(FolderRepository folders, NamedParameterJdbcTemplate jdbc) {
        this.folders = folders;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public FolderListing list(Long userId, Folder.Kind kind) {
        Map<Long, Long> counts = new HashMap<>();
        long[] unfiled = {0};
        // 表名来自枚举，不是用户输入，可以拼
        jdbc.query("SELECT folder_id, count(*) AS n FROM " + kind.table()
                        + " WHERE owner_id = :userId GROUP BY folder_id",
                new MapSqlParameterSource("userId", userId),
                rs -> {
                    long folderId = rs.getLong("folder_id");
                    if (rs.wasNull()) {
                        unfiled[0] = rs.getLong("n");
                    } else {
                        counts.put(folderId, rs.getLong("n"));
                    }
                });
        List<FolderListing.Item> items = folders.findByOwnerIdAndKindOrderByCreatedAtAsc(userId, kind)
                .stream()
                .map(f -> new FolderListing.Item(
                        f.getId(), f.getName(), counts.getOrDefault(f.getId(), 0L), f.getCreatedAt()))
                .toList();
        long total = unfiled[0] + items.stream().mapToLong(FolderListing.Item::count).sum();
        return new FolderListing(items, unfiled[0], total);
    }

    /** 按名字取集，没有就建一个 —— 导入资料包时用。 */
    @Transactional
    public Folder findOrCreate(Long userId, Folder.Kind kind, String rawName) {
        String name = normalize(rawName);
        return folders.findByOwnerIdAndKindAndName(userId, kind, name)
                .orElseGet(() -> create(userId, kind, name));
    }

    @Transactional
    public Folder create(Long userId, Folder.Kind kind, String rawName) {
        String name = normalize(rawName);
        if (folders.findByOwnerIdAndKindAndName(userId, kind, name).isPresent()) {
            throw new FolderNameTakenException(name);
        }
        try {
            return folders.saveAndFlush(new Folder(userId, kind, name, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // 同名并发创建，唯一约束兜住了
            throw new FolderNameTakenException(name);
        }
    }

    @Transactional
    public Folder rename(Long userId, Long id, String rawName) {
        String name = normalize(rawName);
        Folder folder = get(userId, id);
        folders.findByOwnerIdAndKindAndName(userId, folder.getKind(), name)
                .filter(clash -> !clash.getId().equals(id))
                .ifPresent(clash -> {
                    throw new FolderNameTakenException(name);
                });
        folder.rename(name);
        return folder;
    }

    /** 删集不删里面的东西：外键 ON DELETE SET NULL 让它们退回未归档。 */
    @Transactional
    public void delete(Long userId, Long id) {
        folders.delete(get(userId, id));
    }

    @Transactional(readOnly = true)
    public Folder get(Long userId, Long id) {
        return folders.findByIdAndOwnerId(id, userId)
                .orElseThrow(() -> new FolderNotFoundException(id));
    }

    /**
     * 往集里放东西之前验一下：集是这个人的、是这一类的。folderId 为空就是不归档，原样放行。
     */
    @Transactional(readOnly = true)
    public void requireKind(Long userId, Long folderId, Folder.Kind kind) {
        if (folderId != null && get(userId, folderId).getKind() != kind) {
            throw new FolderNotFoundException(folderId);
        }
    }

    private static String normalize(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("集名不能为空");
        }
        return trimmed;
    }
}
