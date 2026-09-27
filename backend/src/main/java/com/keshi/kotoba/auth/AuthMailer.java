package com.keshi.kotoba.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 发验证/重置邮件。三种状态：
 *
 * <ul>
 *   <li>配了 SMTP（spring.mail.host）—— 真发；</li>
 *   <li>没配，但开了 auth.mail.log-links —— 链接打到日志里，本地开发用；</li>
 *   <li>都没有 —— 功能关闭，前端不显示"忘记密码"和"绑定邮箱"。</li>
 * </ul>
 *
 * 发送放到后台线程：SMTP 慢起来好几秒，而且"找回密码"如果只在邮箱存在时才变慢，
 * 响应时间本身就把"这个邮箱注册过"泄露出去了。
 */
@Component
public class AuthMailer {

    private static final Logger log = LoggerFactory.getLogger(AuthMailer.class);

    private final JavaMailSender sender;
    private final boolean logLinks;
    private final String from;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AuthMailer(ObjectProvider<JavaMailSender> sender,
                      @Value("${spring.mail.host:}") String host,
                      @Value("${auth.mail.log-links:false}") boolean logLinks,
                      @Value("${auth.mail.from:}") String from) {
        // host 为空时 Boot 照样会建一个 JavaMailSender（它只看属性在不在），得自己判
        this.sender = host.isBlank() ? null : sender.getIfAvailable();
        this.logLinks = logLinks;
        this.from = from;
    }

    public boolean isEnabled() {
        return sender != null || logLinks;
    }

    public void send(String to, String subject, String body) {
        if (sender == null) {
            if (logLinks) {
                log.info("[邮件未发送，仅开发环境打印] to={} subject={}\n{}", to, subject, body);
            }
            return;
        }
        executor.submit(() -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                if (!from.isBlank()) {
                    message.setFrom(from);
                }
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                sender.send(message);
            } catch (RuntimeException e) {
                log.warn("邮件发送失败 to={} subject={}", to, subject, e);
            }
        });
    }
}
