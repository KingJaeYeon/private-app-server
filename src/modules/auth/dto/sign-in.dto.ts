import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email 또는 username

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
