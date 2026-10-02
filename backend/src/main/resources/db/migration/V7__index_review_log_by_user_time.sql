-- 按人、按时间段查复习记录：彼岸的日格子按天汇总，首页的「今日已复习」也是这么查。
-- 之前只有 card_id 上的索引，这两处都在扫整张表。

CREATE INDEX idx_review_log_user_time ON review_log (user_id, reviewed_at);
