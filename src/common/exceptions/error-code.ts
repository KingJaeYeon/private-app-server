import { HttpStatus } from '@nestjs/common';

interface ErrorDefinition {
  code: string;
  message: string;
  statusCode: HttpStatus;
}

const defineError = (code: string, message: string, statusCode: HttpStatus): ErrorDefinition => ({
  code,
  message,
  statusCode
});
// TODO: i18n 적용 할땐 message: "error.user.not_found" 이런식으로 키값으로 변경해야함
export const ERROR_CODES = {
  // ===== 인증 (AUTH) =====
  INVALID_CREDENTIALS: defineError('AUTH-001', '이메일 또는 비밀번호가 올바르지 않습니다', HttpStatus.UNAUTHORIZED),
  INVALID_TOKEN: defineError('AUTH-002', '유효하지 않은 토큰입니다', HttpStatus.UNAUTHORIZED),
  TOKEN_EXPIRED: defineError('AUTH-003', '토큰이 만료되었습니다', HttpStatus.UNAUTHORIZED),
  REFRESH_TOKEN_EXPIRED: defineError('AUTH-004', '리프레시 토큰이 만료되었습니다', HttpStatus.UNAUTHORIZED),
  REFRESH_TOKEN_REVOKED: defineError('AUTH-005', '리프레시 토큰이 취소되었습니다', HttpStatus.UNAUTHORIZED),
  UNAUTHORIZED: defineError('AUTH-006', '인증이 필요합니다', HttpStatus.UNAUTHORIZED),
  FORBIDDEN: defineError('AUTH-007', '접근 권한이 없습니다', HttpStatus.FORBIDDEN),
  BLACKLIST_IP: defineError('AUTH-008', '요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.', HttpStatus.FORBIDDEN),

  // ===== 사용자 (USER) =====
  USER_NOT_FOUND: defineError('USER-001', '사용자를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  USER_ALREADY_EXISTS: defineError('USER-002', '이미 존재하는 사용자입니다', HttpStatus.CONFLICT),
  EMAIL_ALREADY_EXISTS: defineError('USER-003', '이미 사용 중인 이메일입니다', HttpStatus.CONFLICT),
  USERNAME_ALREADY_EXISTS: defineError('USER-004', '이미 사용 중인 사용자명입니다', HttpStatus.CONFLICT),
  USER_BLOCKED: defineError('USER-005', '차단된 사용자입니다', HttpStatus.FORBIDDEN),
  USER_WITHDRAWN: defineError('USER-006', '탈퇴한 사용자입니다', HttpStatus.FORBIDDEN),
  EMAIL_NOT_VERIFIED: defineError('USER-007', '이메일 인증이 필요합니다', HttpStatus.FORBIDDEN),

  // ===== 이메일 인증 (VERIFICATION) =====
  VERIFICATION_NOT_FOUND: defineError('VERIFICATION-001', '인증 정보를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  VERIFICATION_EXPIRED: defineError('VERIFICATION-002', '인증 코드가 만료되었습니다', HttpStatus.BAD_REQUEST),
  VERIFICATION_INVALID: defineError('VERIFICATION-003', '유효하지 않은 인증 코드입니다', HttpStatus.BAD_REQUEST),
  VERIFICATION_ALREADY_USED: defineError('VERIFICATION-004', '이미 사용된 인증 코드입니다', HttpStatus.BAD_REQUEST),

  // ===== 채널 (CHANNEL) =====
  CHANNEL_NOT_FOUND: defineError('CHANNEL-001', '채널을 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  CHANNEL_ALREADY_EXISTS: defineError('CHANNEL-002', '이미 등록된 채널입니다', HttpStatus.CONFLICT),
  INVALID_CHANNEL_ID: defineError('CHANNEL-003', '유효하지 않은 채널 ID입니다', HttpStatus.BAD_REQUEST),

  // ===== 구독 (SUBSCRIPTION) =====
  SUBSCRIPTION_NOT_FOUND: defineError('SUBSCRIPTION-001', '구독 정보를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  ALREADY_SUBSCRIBED: defineError('SUBSCRIPTION-002', '이미 구독한 채널입니다', HttpStatus.CONFLICT),
  SUBSCRIPTION_LIMIT_EXCEEDED: defineError(
    'SUBSCRIPTION-003',
    '구독 가능한 채널 수를 초과했습니다',
    HttpStatus.BAD_REQUEST
  ),
  NOT_SUBSCRIBED: defineError('SUBSCRIPTION-004', '구독하지 않은 채널입니다', HttpStatus.BAD_REQUEST),

  // ===== 레퍼런스 (REFERENCE) =====
  REFERENCE_NOT_FOUND: defineError('REFERENCE-001', '레퍼런스를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  REFERENCE_LIMIT_EXCEEDED: defineError('REFERENCE-002', '레퍼런스 개수 제한을 초과했습니다', HttpStatus.BAD_REQUEST),

  // ===== 태그 (TAG) =====
  TAG_NOT_FOUND: defineError('TAG-001', '태그를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  TAG_ALREADY_EXISTS: defineError('TAG-002', '이미 존재하는 태그입니다', HttpStatus.CONFLICT),
  TAG_LIMIT_EXCEEDED: defineError('TAG-003', '태그 개수 제한을 초과했습니다', HttpStatus.BAD_REQUEST),
  TAG_RELATION_NOT_FOUND: defineError('TAG-004', '태그 연결을 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  TAG_ALREADY_ATTACHED: defineError('TAG-005', '이미 연결된 태그입니다', HttpStatus.CONFLICT),

  // ===== 일반 (COMMON) =====
  VALIDATION_ERROR: defineError('COMMON-001', '입력값 검증에 실패했습니다', HttpStatus.BAD_REQUEST),
  NOT_FOUND: defineError('COMMON-002', '요청한 리소스를 찾을 수 없습니다', HttpStatus.NOT_FOUND),
  BAD_REQUEST: defineError('COMMON-003', '잘못된 요청입니다', HttpStatus.BAD_REQUEST),
  CONFLICT: defineError('COMMON-004', '이미 존재하는 리소스입니다', HttpStatus.CONFLICT),
  TO_MANY_REQUEST: defineError(
    'COMMON-005',
    '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
    HttpStatus.TOO_MANY_REQUESTS
  ),
  TO_MANY_REQUEST_BLOCK: defineError(
    'COMMON-005',
    '요청이 너무 많습니다. 고객센터로 문의해주세요',
    HttpStatus.TOO_MANY_REQUESTS
  ),

  // ===== 시스템 (INTERNAL) - 클라이언트에 상세 정보 노출 금지 =====
  INTERNAL_SERVER_ERROR: defineError(
    'INTERNAL-001',
    '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
    HttpStatus.INTERNAL_SERVER_ERROR
  ),
  DATABASE_ERROR: defineError(
    'INTERNAL-002',
    '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
    HttpStatus.INTERNAL_SERVER_ERROR
  ),
  SERVICE_UNAVAILABLE: defineError(
    'INTERNAL-003',
    '서비스를 일시적으로 이용할 수 없습니다',
    HttpStatus.SERVICE_UNAVAILABLE
  )
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
