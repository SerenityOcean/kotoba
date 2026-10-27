package com.keshi.kotoba.exam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 一份卷子：大题 → 本文 → 小题。由前端从讲义（.docx / .txt）里解析、注好音再提交，
 * 这边只校验形状和大小，整份存成 JSON。
 *
 * <p>形状和前端 {@code exam.ts} 里的类型一一对应，两边改要一起改。
 */
public record ExamContent(

        @NotNull
        @Size(max = 20, message = "卷首说明太多了")
        List<@NotNull @Size(max = 1000, message = "卷首说明太长了") String> preface,

        @NotEmpty(message = "卷子里没有题目")
        @Size(max = 30, message = "大题太多了")
        List<@NotNull @Valid Section> sections
) {

    /** 一道大题，「問題10　短篇阅读」。没有大题标记的讲义 label、name 都是空串。 */
    public record Section(
            @NotNull @Size(max = 50, message = "大题标题太长了") String label,
            @NotNull @Size(max = 100, message = "大题标题太长了") String name,
            @NotNull @Size(max = 30, message = "一道大题里的本文太多了") List<@NotNull @Valid Passage> passages
    ) {
    }

    /** 一篇本文和它下面的小题。对比阅读的 A、B 是同一篇里的两段，用 part 块隔开。 */
    public record Passage(
            @NotNull @Size(max = 50, message = "本文标签太长了") String label,
            @NotNull @Size(max = 300, message = "一篇本文分段太多了") List<@NotNull @Valid Block> blocks,
            @NotNull @Size(max = 30, message = "一篇本文下面的题太多了") List<@NotNull @Valid Question> questions
    ) {
    }

    /** 本文里的一块。note 的 mark 是「注1」，其余为 null。 */
    public record Block(
            @NotNull @Pattern(regexp = "text|intro|part|note|source", message = "不认识的段落类型") String kind,
            @NotNull @Size(max = 20000, message = "本文有一段太长了") String text,
            @Size(max = 20) String mark
    ) {
    }

    /** answer 从 1 数；null = 讲义里没给答案，这题不计分。 */
    public record Question(
            @Min(value = 1, message = "题号不对") @Max(value = 9999, message = "题号不对") int number,
            @NotNull @Size(max = 5000, message = "题干太长了") String stem,
            @NotNull @Size(max = 50, message = "题目附的材料太多了")
            List<@NotNull @Size(max = 5000, message = "题目附的材料太长了") String> extra,
            @NotNull @Size(max = 8, message = "选项太多了")
            List<@NotNull @Size(max = 2000, message = "选项太长了") String> choices,
            @Min(value = 1, message = "答案不对") @Max(value = 8, message = "答案不对") Integer answer
    ) {
    }

    /** 所有小题，按卷面顺序。 */
    public List<Question> questions() {
        return sections.stream()
                .flatMap(section -> section.passages().stream())
                .flatMap(passage -> passage.questions().stream())
                .toList();
    }
}
