-- Grandfather every account that existed before email verification was added,
-- so the new "verify before login" rule doesn't lock them out. Marks them
-- verified as of when they registered. New signups (created after this runs)
-- still go through the 6-digit code flow.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
