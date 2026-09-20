package com.keshi.kotoba.analyze;

import com.anthropic.client.AnthropicClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AnalyzeServiceTest {

    /** 没配 key 时容器里就没有 AnthropicClient，getIfAvailable() 回 null。 */
    private static ObjectProvider<AnthropicClient> noClient() {
        return new ObjectProvider<>() {
            @Override
            public AnthropicClient getIfAvailable() {
                return null;
            }

            @Override
            public AnthropicClient getObject() {
                throw new UnsupportedOperationException();
            }

            @Override
            public AnthropicClient getObject(Object... args) {
                throw new UnsupportedOperationException();
            }

            @Override
            public AnthropicClient getIfUnique() {
                return null;
            }
        };
    }

    @Test
    @DisplayName("没配 API key 时拆解请求被明确拒掉，而不是抛 NPE")
    void withoutApiKeyAnalyzeIsRejected() {
        AnalyzeService service = new AnalyzeService(noClient(), "claude-sonnet-5");

        assertThrows(AnalysisUnavailableException.class, () -> service.analyze("勉強する"));
    }
}
