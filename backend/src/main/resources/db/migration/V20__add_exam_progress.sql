-- 应试：做到一半的进度存到后端，换台设备打开还是做到那儿。一份卷子一行，
-- 卷子本身分了人，这里不再存 owner。answers 和交卷记录一样是 {"55": 3, …}；
-- recorded_attempt_id 是这一遍做完记下的那次成绩，有了就不再重复记、页面显示成绩卡。
-- 重做一遍是把这一行清空（answers 变 {}），不删行：updated_at 留着，几台设备才比得出谁新。

CREATE TABLE exam_progress (
    exam_id             bigint      PRIMARY KEY REFERENCES exam (id) ON DELETE CASCADE,
    answers             text        NOT NULL,
    elapsed_seconds     integer     NOT NULL,
    recorded_attempt_id bigint      REFERENCES exam_attempt (id) ON DELETE SET NULL,
    updated_at          timestamptz NOT NULL
);
