package com.keshi.kotoba.exam;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ExamNotFoundException extends RuntimeException {

    public ExamNotFoundException(Long id) {
        super("Exam not found: " + id);
    }
}
