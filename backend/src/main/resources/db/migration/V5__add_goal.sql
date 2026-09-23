-- 彼岸：每个用户至多一个目标，所以直接拿 owner_id 当主键。
-- started_at 是这次目标开始的时刻，周格子从这里数起；只改名改日期时不动它。

CREATE TABLE goal (
                      owner_id    bigint      PRIMARY KEY REFERENCES app_user (id),
                      title       text        NOT NULL,
                      target_date date        NOT NULL,
                      started_at  timestamptz NOT NULL DEFAULT now()
);
