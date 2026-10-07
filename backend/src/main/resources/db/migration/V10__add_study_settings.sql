-- 每个人自己的学习节奏。现在只有一项：每天放出多少张新卡。
-- 没有这一行 = 用默认值（每天 20 张）；daily_new_limit 是 NULL = 不限。

CREATE TABLE study_settings (
    user_id         bigint PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    daily_new_limit integer CHECK (daily_new_limit IS NULL OR daily_new_limit >= 0)
);
