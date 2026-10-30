package com.keshi.kotoba.pay;

/** 支付宝那边回了错，或者回来的东西验签不过。 */
public class AlipayException extends RuntimeException {

    public AlipayException(String message) {
        super(message);
    }
}
