package com.keshi.kotoba.auth;

/** 没配体验账号，或者配了但库里还没建这个号。 */
class DemoUnavailableException extends RuntimeException {

    DemoUnavailableException(String message) {
        super(message);
    }
}
