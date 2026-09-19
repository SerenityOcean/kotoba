package com.keshi.kotoba.deck;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class DeckNameTakenException extends RuntimeException {

    public DeckNameTakenException(String name) {
        super("已经有一个叫「" + name + "」的包了");
    }
}
