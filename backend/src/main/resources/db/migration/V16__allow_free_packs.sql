-- 免费资料包：价格 0 = 谁都算拥有，不能下单（见 Pack#free）。V14 里价格只许大于 0，放宽到不为负。

ALTER TABLE pack DROP CONSTRAINT pack_price_cents_check;
ALTER TABLE pack ADD CONSTRAINT ck_pack_price_not_negative CHECK (price_cents >= 0);
