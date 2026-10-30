package com.keshi.kotoba.library;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/** 一笔支付宝订单。金额下单时记下，之后改价不影响核对旧订单。 */
@Entity
@Table(name = "pack_order")
public class PackOrder {

    public enum Status { CREATED, PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String outTradeNo;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long packId;

    @Column(nullable = false)
    private int amountCents;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private Status status;

    @Column(columnDefinition = "text")
    private String tradeNo;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant paidAt;

    protected PackOrder() {
    }

    public PackOrder(String outTradeNo, Long userId, Long packId, int amountCents, Instant now) {
        this.outTradeNo = outTradeNo;
        this.userId = userId;
        this.packId = packId;
        this.amountCents = amountCents;
        this.status = Status.CREATED;
        this.createdAt = now;
    }

    void markPaid(String tradeNo, Instant now) {
        this.status = Status.PAID;
        this.tradeNo = tradeNo;
        this.paidAt = now;
    }

    /** 元，两位小数：支付宝那边的 total_amount 是这个样子。 */
    public BigDecimal amount() {
        return BigDecimal.valueOf(amountCents, 2);
    }

    public boolean paid() {
        return status == Status.PAID;
    }

    public String getOutTradeNo() {
        return outTradeNo;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getPackId() {
        return packId;
    }

    public Status getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
