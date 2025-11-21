  맨 처음 크롤러 실행시킨 이후, 트리거, 이벤트 등록해야함. 모두 실행 필요

-- 스케줄러 이벤트
SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS reset_weekly_view_count
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
  UPDATE popup_stores SET weekly_view_count = 0;

-- 트리거
  DROP TRIGGER IF EXISTS favorites_after_insert;
  DROP TRIGGER IF EXISTS favorites_after_delete;

  DELIMITER $$
  CREATE TRIGGER favorites_after_insert
  AFTER INSERT ON favorites
  FOR EACH ROW
  BEGIN
    UPDATE popup_stores
    SET favorite_count = (
      SELECT COUNT(*) FROM favorites WHERE popup_id = NEW.popup_id
    )
    WHERE id = NEW.popup_id;
  END$$
  DELIMITER ;

  DELIMITER $$
  CREATE TRIGGER favorites_after_delete
  AFTER DELETE ON favorites
  FOR EACH ROW
  BEGIN
    UPDATE popup_stores
    SET favorite_count = (
      SELECT COUNT(*) FROM favorites WHERE popup_id = OLD.popup_id
    )
    WHERE id = OLD.popup_id;
  END$$
  DELIMITER ;

