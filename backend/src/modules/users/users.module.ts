import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // For `AuthService.revokeAllForUser`, so a password change ends the
  // sessions it was meant to end (F9.4). Safe from a cycle: AuthModule
  // depends on Passport/JWT/Throttler and Prisma, never on UsersModule —
  // InvitationsModule already reuses AuthService the same way.
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
