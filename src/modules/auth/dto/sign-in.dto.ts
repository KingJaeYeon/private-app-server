import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignInDto {
  /**
   * 이메일 또는 사용자명
   * @example  "user@example.com | username"
   */
  @IsString()
  @IsNotEmpty()
  identifier: string;

  /**
   * 비밀번호 (4자 이상)
   * @example "1234"
   */
  @IsString()
  @MinLength(4)
  @IsNotEmpty()
  password: string;
}
