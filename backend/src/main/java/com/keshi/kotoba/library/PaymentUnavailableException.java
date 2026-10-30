package com.keshi.kotoba.library;

/** 后端没配支付宝。 */
public class PaymentUnavailableException extends RuntimeException {

    public PaymentUnavailableException() {
        super("在线支付还没开通，可以先用兑换码");
    }
}
