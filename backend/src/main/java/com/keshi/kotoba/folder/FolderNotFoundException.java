package com.keshi.kotoba.folder;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class FolderNotFoundException extends RuntimeException {

    public FolderNotFoundException(Long id) {
        super("Folder not found: " + id);
    }
}
