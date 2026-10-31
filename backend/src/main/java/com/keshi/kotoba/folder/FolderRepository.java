package com.keshi.kotoba.folder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FolderRepository extends JpaRepository<Folder, Long> {

    List<Folder> findByOwnerIdAndKindOrderByCreatedAtAsc(Long ownerId, Folder.Kind kind);

    /** 带 ownerId 的查询 = 归属校验。查不到就是 404。 */
    Optional<Folder> findByIdAndOwnerId(Long id, Long ownerId);

    Optional<Folder> findByOwnerIdAndKindAndName(Long ownerId, Folder.Kind kind, String name);
}
