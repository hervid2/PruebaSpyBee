import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * What the client still gets to say about an attachment after F9.5: where it
 * put it, and what to call it. `type`, `format` and `size` used to be here
 * too and are now read off the stored object instead (`MediaService.create`)
 * — they were unverifiable claims, and the size cap was selected by the
 * client-chosen `type`, so naming `video` raised an image's ceiling to
 * 200 MB.
 */
export class CreateMediaDto {
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
