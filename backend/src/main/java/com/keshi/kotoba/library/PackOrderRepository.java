package com.keshi.kotoba.library;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PackOrderRepository extends JpaRepository<PackOrder, Long> {

    Optional<PackOrder> findByOutTradeNo(String outTradeNo);

    /**
     * 确认付款时锁住这一行：异步通知和前端轮询的查单可能同时到，
     * 后到的那个要等前一个提交了再看状态，免得两边都以为是自己第一个确认的。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from PackOrder o where o.outTradeNo = :no")
    Optional<PackOrder> lockByOutTradeNo(@Param("no") String outTradeNo);

    /** 刚下过、还没付的那一单：再点一次「解锁」时接着用它，不另开一单。 */
    Optional<PackOrder> findFirstByUserIdAndPackIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
            Long userId, Long packId, PackOrder.Status status, Instant after);
}
