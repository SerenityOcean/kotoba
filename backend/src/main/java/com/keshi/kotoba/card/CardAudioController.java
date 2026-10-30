package com.keshi.kotoba.card;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** 卡片自带的录音：导入时上传，复习时放。 */
@RestController
@RequestMapping("/api/cards")
public class CardAudioController {

    /**
     * 一批最多几段。Tomcat 默认一个请求最多 50 个 part，留点余量；
     * nginx 那边一个请求 2 MB，前端也按大小分批。
     */
    static final int MAX_BATCH = 40;

    private final CardAudioService audioService;

    public CardAudioController(CardAudioService audioService) {
        this.audioService = audioService;
    }

    /**
     * 传一批录音（multipart）。每个文件的字段名是「卡片 id.类型」，比如 {@code 12.word}、
     * {@code 12.sentence}；文件本身的类型就是录音格式（audio/mpeg 之类）。
     */
    @PostMapping(path = "/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Integer> upload(@AuthenticationPrincipal AppUserPrincipal user,
                                       MultipartHttpServletRequest request) throws IOException {
        Map<String, MultipartFile> files = request.getFileMap();
        if (files.isEmpty() || files.size() > MAX_BATCH) {
            throw new IllegalArgumentException("一次传 1 到 " + MAX_BATCH + " 段录音");
        }

        List<CardAudioService.Upload> uploads = new ArrayList<>();
        for (Map.Entry<String, MultipartFile> entry : files.entrySet()) {
            String[] parts = entry.getKey().split("\\.", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("录音的字段名要写成「卡片 id.类型」：" + entry.getKey());
            }
            long cardId;
            try {
                cardId = Long.parseLong(parts[0]);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("录音的字段名要写成「卡片 id.类型」：" + entry.getKey());
            }
            MultipartFile file = entry.getValue();
            uploads.add(new CardAudioService.Upload(
                    cardId, AudioKind.parse(parts[1]), file.getContentType(), file.getBytes()));
        }

        return Map.of("stored", audioService.store(user.id(), uploads, Instant.now()));
    }

    /**
     * 放一段录音。回 Resource 是为了让 Spring 处理 Range 请求 ——
     * Safari 放音频先要 0-1 字节试探，服务器不回 206 它就不放。
     *
     * <p>浏览器缓存一周：同一张卡的录音基本不会变，复习时反复听不用每次过网络。
     */
    @GetMapping("/{id}/audio/{kind}")
    public ResponseEntity<Resource> play(@AuthenticationPrincipal AppUserPrincipal user,
                                         @PathVariable Long id,
                                         @PathVariable String kind) {
        CardAudio audio = audioService.load(user.id(), id, AudioKind.parse(kind));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(audio.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
                .body(new ByteArrayResource(audio.getData()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(AudioQuotaExceededException.class)
    @ResponseStatus(HttpStatus.PAYLOAD_TOO_LARGE)
    ApiError onQuotaExceeded(AudioQuotaExceededException e) {
        return new ApiError(e.getMessage());
    }
}
