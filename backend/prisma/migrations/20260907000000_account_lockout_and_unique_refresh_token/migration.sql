-- F9.5.
--
-- RefreshToken.tokenHash becomes UNIQUE so `AuthService.refresh` can look a
-- token up with `findUnique`. Invitation.tokenHash and ExportToken.tokenHash
-- have always been unique; this one was not, which left F9.4's refresh-token
-- reuse detection resting on a property the database did not enforce. The
-- values are SHA-256 digests of 64 random bytes, so there is nothing to
-- deduplicate first.
--
-- User gains a per-account failed-login counter and lock window. Rate
-- limiting is per IP and per Lambda instance; nothing counted failures
-- against a single account, so an attempt spread across addresses was
-- unbounded.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
