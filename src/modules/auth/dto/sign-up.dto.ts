import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(4)
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  verifyCode: string;
}
