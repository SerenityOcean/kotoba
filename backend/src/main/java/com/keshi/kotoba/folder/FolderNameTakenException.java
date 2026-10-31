package com.keshi.kotoba.folder;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class FolderNameTakenException extends RuntimeException {

    public FolderNameTakenException(String name) {
        super("已经有一个叫「" + name + "」的集了");
    }
}
