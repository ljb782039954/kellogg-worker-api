-- Create media_references table to track image usages
CREATE TABLE IF NOT EXISTS media_references (
  image_key TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  PRIMARY KEY (image_key, entity_type, entity_id)
);
