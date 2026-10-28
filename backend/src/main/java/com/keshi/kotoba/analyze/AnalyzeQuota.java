package com.keshi.kotoba.analyze;

import com.keshi.kotoba.web.RateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * 拆解要花钱调模型，而注册是开放的 —— 不设上限的话，谁注册个号就能一直刷余额。三层：
 *
 * <ul>
 *   <li>每人每分钟：挡脚本狂刷。拆解页一段话按句并行发（最多 20 句），所以不能设太小；</li>
 *   <li>每人 24 小时：正常学习用不完，刷子一天也花不了几块钱；</li>
 *   <li>全站 24 小时：批量注册小号绕过上面两层时，总花费也有个顶。</li>
 * </ul>
 *
 * 共用的体验账号另有一道 24 小时的上限，比普通账号小得多：所有访客合用这一份。
 *
 * 计数在内存里（和登录限流一样），重启清零。先查三层再一起记，免得前一层记了数、
 * 后一层把请求拒了。查和记之间不是原子的，并发时可能多放过一两次，无所谓。
 */
@Component
public class AnalyzeQuota {

    private static final String GLOBAL = "*";

    private final RateLimiter perUserMinute;
    private final RateLimiter perUserDay;
    private final RateLimiter globalDay;
    private final RateLimiter demoDay;
    private final int perDay;
    private final int demoPerDay;

    public AnalyzeQuota(Clock clock,
                        @Value("${analyze.limit.per-user-per-minute:30}") int perMinute,
                        @Value("${analyze.limit.per-user-per-day:300}") int perDay,
                        @Value("${analyze.limit.global-per-day:2000}") int globalPerDay,
                        @Value("${analyze.limit.demo-per-day:20}") int demoPerDay) {
        this.perUserMinute = new RateLimiter(perMinute, Duration.ofMinutes(1), clock);
        this.perUserDay = new RateLimiter(perDay, Duration.ofDays(1), clock);
        this.globalDay = new RateLimiter(globalPerDay, Duration.ofDays(1), clock);
        this.demoDay = new RateLimiter(demoPerDay, Duration.ofDays(1), clock);
        this.perDay = perDay;
        this.demoPerDay = demoPerDay;
    }

    /** 记一次拆解；超了就抛 {@link AnalyzeLimitException}，不记数。 */
    public void acquire(Long userId) {
        acquire(userId, false);
    }

    /** demo = 共用的体验账号，多过一道体验号的上限。 */
    public void acquire(Long userId, boolean demo) {
        String user = userId.toString();
        Duration wait = perUserMinute.blockedFor(user);
        if (wait != null) {
            throw new AnalyzeLimitException("拆得太快了，" + humanize(wait) + "后再试", wait);
        }
        wait = perUserDay.blockedFor(user);
        if (wait != null) {
            throw new AnalyzeLimitException(
                    "24 小时内最多拆解 " + perDay + " 次，" + humanize(wait) + "后恢复", wait);
        }
        if (demo) {
            wait = demoDay.blockedFor(user);
            if (wait != null) {
                throw new AnalyzeLimitException("体验账号大家共用，24 小时内一共能拆 " + demoPerDay
                        + " 次，已经用完了。注册一个，就有自己的额度", wait);
            }
        }
        wait = globalDay.blockedFor(GLOBAL);
        if (wait != null) {
            throw new AnalyzeLimitException("今天全站的拆解额度用完了，" + humanize(wait) + "后恢复", wait);
        }
        perUserMinute.hit(user);
        perUserDay.hit(user);
        if (demo) {
            demoDay.hit(user);
        }
        globalDay.hit(GLOBAL);
    }

    private static String humanize(Duration wait) {
        long minutes = Math.max(1, (wait.toSeconds() + 59) / 60);
        return minutes < 60 ? minutes + " 分钟" : (minutes + 59) / 60 + " 小时";
    }
}
