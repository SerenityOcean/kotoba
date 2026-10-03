package com.keshi.kotoba.self;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class EssayService {

    /** 随笔不是文章，五千字够写很长的一天了。 */
    static final int MAX_LENGTH = 5000;
    /** 一页最多这么多条，前端默认要得更少。 */
    static final int MAX_PAGE = 100;

    private final EssayRepository essays;

    public EssayService(EssayRepository essays) {
        this.essays = essays;
    }

    /**
     * 从 beforeId（不含）往前取一页；beforeId 为空就从最新的开始。
     * 多取一条用来判断后面还有没有，不用另外 count。
     */
    @Transactional(readOnly = true)
    public EssayPage page(Long beforeId, int limit) {
        int size = Math.max(1, Math.min(limit, MAX_PAGE));
        PageRequest firstN = PageRequest.of(0, size + 1);
        List<Essay> found = beforeId == null
                ? essays.findAllByOrderByIdDesc(firstN)
                : essays.findByIdLessThanOrderByIdDesc(beforeId, firstN);
        boolean hasMore = found.size() > size;
        return new EssayPage(hasMore ? found.subList(0, size) : found, hasMore, essays.count());
    }

    @Transactional(readOnly = true)
    public Essay find(Long id) {
        return essays.findById(id).orElseThrow(EssayNotFoundException::new);
    }

    @Transactional
    public Essay write(String rawBody, Instant now) {
        return essays.save(new Essay(normalize(rawBody), now));
    }

    @Transactional
    public Essay revise(Long id, String rawBody, Instant now) {
        Essay essay = essays.findById(id).orElseThrow(EssayNotFoundException::new);
        essay.revise(normalize(rawBody), now);
        return essay;
    }

    @Transactional
    public void delete(Long id) {
        Essay essay = essays.findById(id).orElseThrow(EssayNotFoundException::new);
        essays.delete(essay);
    }

    /**
     * 换行统一成 \n，去掉首尾空白，连着的空行并成一个 —— 前端按行分段，
     * 多出来的空行只会撑出空段落。
     */
    static String normalize(String raw) {
        String body = raw == null ? "" : raw
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .replaceAll("[ \\t]+\\n", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
        if (body.isEmpty()) {
            throw new IllegalArgumentException("写点什么再落笔吧");
        }
        if (body.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("一条最多 " + MAX_LENGTH + " 字");
        }
        return body;
    }

    public record EssayPage(List<Essay> essays, boolean hasMore, long total) {
    }
}
