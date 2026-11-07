-- 资料包也能带真题卷：解锁导入时进应试页。卷子和卡片、文章一样存在 content 的 JSON 里，
-- 份数单拎一列，书架要显示。
ALTER TABLE pack ADD COLUMN exam_count integer NOT NULL DEFAULT 0;
