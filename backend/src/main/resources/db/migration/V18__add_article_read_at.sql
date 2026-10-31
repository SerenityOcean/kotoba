-- 文章读没读过：打开一篇时记下时间，列表能按已读 / 未读筛。空就是没读。
ALTER TABLE article ADD COLUMN read_at timestamptz;
