/**
 * bcrypt work factor, in one place (F9.5). It used to be declared three times
 * — `UsersService`, `InvitationsService`, and a bare `10` inline in
 * `prisma/seed.ts` — which is how the seed and the app quietly disagree about
 * password cost after somebody raises one of them.
 *
 * Left at 10 rather than the 12 the follow-up list asked me to consider, on
 * the strength of the measurement rather than the convention. On this
 * machine a `bcrypt.compare` costs ~220 ms at 10 and ~780 ms at 12; the API
 * runs as a 512 MB Lambda, which is allotted roughly a third of a vCPU
 * (a full vCPU arrives at 1769 MB), so the same comparison lands nearer
 * 2-3 s there — on the login path, on top of a cold start. 10 is still at or
 * above the floor OWASP asks for.
 *
 * Raise this to 12 together with `MemorySize` in `template.yaml`, not on its
 * own: at 1769 MB the 12-round comparison costs about what 10 costs today.
 * The offline-cracking cost that buys is real, but it is not worth a
 * multi-second login at the current memory setting.
 */
export const BCRYPT_SALT_ROUNDS = 10;
