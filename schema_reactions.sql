CREATE TABLE IF NOT EXISTS reactions (
  item_id  INTEGER NOT NULL,
  account  TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK(reaction IN ('heart','cross')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, account)
);
