import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Same shape and same reasoning as `CreateMediaDto` after F9.5 — the object is what describes itself. */
export class CreateProjectPlanDto {
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
