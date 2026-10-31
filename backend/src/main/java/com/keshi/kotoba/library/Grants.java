package com.keshi.kotoba.library;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 解锁记录。不管钱从哪儿来，最后都落到这里的一行：资料包导入、付费随笔都只认它。
 *
 * <p>直接写 SQL：发放要的是「插得进就插，已有就算了」，并发的两次通知、
 * 付完钱又输了兑换码，都靠 ON CONFLICT 一句挡掉，不用先查再插。
 */
@Repository
public class Grants {

    public enum Source { ALIPAY, CODE, GIFT }

    public record Grant(Long packId, Source source, Instant grantedAt, Instant importedAt) {
    }

    private final JdbcTemplate jdbc;

    public Grants(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 发一份。已经有了就什么也不做，返回 false。 */
    public boolean grant(Long userId, Long packId, Source source, String ref, Instant now) {
        return jdbc.update("""
                INSERT INTO pack_grant (user_id, pack_id, source, ref, granted_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, pack_id) DO NOTHING
                """, userId, packId, source.name(), ref, Timestamp.from(now)) == 1;
    }

    public Optional<Grant> find(Long userId, Long packId) {
        List<Grant> found = jdbc.query("""
                SELECT pack_id, source, granted_at, imported_at FROM pack_grant
                WHERE user_id = ? AND pack_id = ?
                """, (rs, row) -> new Grant(
                rs.getLong("pack_id"),
                Source.valueOf(rs.getString("source")),
                rs.getTimestamp("granted_at").toInstant(),
                rs.getTimestamp("imported_at") == null ? null : rs.getTimestamp("imported_at").toInstant()),
                userId, packId);
        return found.stream().findFirst();
    }

    public boolean owns(Long userId, Long packId) {
        return find(userId, packId).isPresent();
    }

    /** 书架上一次标出哪些包已经解锁。 */
    public Set<Long> ownedPackIds(Long userId) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT pack_id FROM pack_grant WHERE user_id = ?", Long.class, userId));
    }

    /** 导入过的包：整理旧文章时按这些包的标题对。 */
    public Set<Long> importedPackIds(Long userId) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT pack_id FROM pack_grant WHERE user_id = ? AND imported_at IS NOT NULL",
                Long.class, userId));
    }

    public void markImported(Long userId, Long packId, Instant now) {
        jdbc.update("UPDATE pack_grant SET imported_at = ? WHERE user_id = ? AND pack_id = ?",
                Timestamp.from(now), userId, packId);
    }
}
