package com.keshi.kotoba.pay;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * 支付宝开放平台的 RSA2 签名（SHA256withRSA）。
 *
 * <p>待签的串：参数按名字排序，去掉空值和排除的那几个，拼成 k=v&k=v（值不做 URL 编码）。
 * 发请求时排除 sign；验异步通知时 sign 和 sign_type 都排除 —— 两处规则不一样，是支付宝定的。
 */
public final class AlipaySignature {

    private AlipaySignature() {
    }

    public static String content(Map<String, String> params, Set<String> exclude) {
        return new TreeMap<>(params).entrySet().stream()
                .filter(e -> !exclude.contains(e.getKey()))
                .filter(e -> e.getValue() != null && !e.getValue().isEmpty())
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));
    }

    public static String sign(String content, PrivateKey key) {
        try {
            Signature signer = Signature.getInstance("SHA256withRSA");
            signer.initSign(key);
            signer.update(content.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signer.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("支付宝签名失败", e);
        }
    }

    public static boolean verify(String content, String sign, PublicKey key) {
        if (sign == null || sign.isBlank()) {
            return false;
        }
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(key);
            verifier.update(content.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.getDecoder().decode(sign));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // 签名不是合法 base64、长度不对：都算验不过
            return false;
        }
    }

    /** 应用私钥：支付宝密钥工具生成的「PKCS8（Java 适用）」那一串。带不带 PEM 头都认。 */
    public static PrivateKey privateKey(String base64) {
        try {
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(decodeKey(base64)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException("应用私钥读不出来：要 PKCS8 格式（支付宝密钥工具里选「PKCS8（Java 适用）」）", e);
        }
    }

    /** 支付宝公钥：开放平台「接口加签方式」里给的那串，不是自己的应用公钥。 */
    public static PublicKey publicKey(String base64) {
        try {
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decodeKey(base64)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException("支付宝公钥读不出来", e);
        }
    }

    private static byte[] decodeKey(String text) {
        String body = text.replaceAll("-----(BEGIN|END)[A-Z ]+-----", "").replaceAll("\\s", "");
        return Base64.getDecoder().decode(body);
    }
}
