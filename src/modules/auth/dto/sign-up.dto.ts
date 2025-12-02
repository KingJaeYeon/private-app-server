import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  /**
   * 이메일
   * @example  "user@example.com"
   */
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * 비밀번호 (8자 이상)
   * @example  "password123"
   */
  @IsString()
  @MinLength(4)
  @IsNotEmpty()
  password: string;

  /**
   * 인증코드
   * @example  "dmsak2313"
   */
  @IsString()
  @IsOptional()
  verifyCode: string;
}
