-- ===========================================================================
-- Milestone B: dedicated PUBLIC DEMO identity.
--
-- This is NOT a real account and NOT a real person or company. It is a
-- fictional, platform-wide, READ-ONLY observer used by POST /api/auth/demo-login
-- so a portfolio visitor can explore the map, analytics and forecasts without
-- any credentials.
--
--   * email : demo@toll-analysis.example   (.example is a reserved test TLD)
--   * role  : demo   (read analytics + forecasts only; see docs/AUTHORIZATION.md)
--
-- demo-login takes NO input, so the password is never checked. The hash below
-- is bcrypt of a throwaway random value and exists only to satisfy the NOT NULL
-- column.
--
-- Runs after 01-schema.sql / 02-data.sql on a fresh volume.
-- ===========================================================================

ALTER TABLE `users`
  MODIFY `user_role`
  ENUM('admin','aodos','gefyra','egnatia','kentrikiodos','moreas','neaodos','olympiaodos','demo')
  COLLATE utf8mb4_unicode_ci NOT NULL;

INSERT INTO `users` (`user_email`, `user_password`, `user_role`)
VALUES (
  'demo@toll-analysis.example',
  '$2a$10$JKvsBDHQ7NOxtfXpkO3YW.5gMvhBf0BzW/8ffmRVEIaxOEZMppq7u',
  'demo'
)
ON DUPLICATE KEY UPDATE `user_role` = 'demo';
