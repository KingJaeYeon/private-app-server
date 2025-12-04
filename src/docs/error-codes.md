## 🌐 Global & Base Error Codes Documentation

이 문서는 서비스 API에서 발생 가능한 모든 오류 코드를 정리한 문서입니다.

<details>
<summary>🏷 GLOBAL Errors</summary>

| Code | HTTP Status | Message | serverMessage |
|------|------------|---------|---------------|
| INTERNAL-001 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Unhandled internal error. |
| INTERNAL-002 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요 | Database connection error. |
| INTERNAL-003 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Database error occurred. |
| INTERNAL-004 | 503 | 서비스를 일시적으로 이용할 수 없습니다. | External service unavailable. |
| INTERNAL-005 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Prisma validation failed before executing SQL |
| GLOBAL-001 | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. | Rate limit exceeded. |
| GLOBAL-002 | 403 | 요청을 처리할 수 없습니다. 관리자에게 문의하세요. | Blocked by security policy – IP blacklisted. |
</details>

<details>
<summary>🏷 BASE Errors</summary>

| Code | HTTP Status | Message |
|------|------------|---------|
| COMMON-001 | 400 | 입력값 검증에 실패했습니다 |
| AUTH-001 | 401 | 이메일 또는 비밀번호가 올바르지 않습니다 |
| AUTH-002 | 401 | 유효하지 않은 토큰입니다 |
| AUTH-003 | 401 | 토큰이 만료되었습니다 |
| AUTH-004 | 401 | 리프레시 토큰이 만료되었습니다 |
| AUTH-005 | 401 | 리프레시 토큰이 취소되었습니다 |
| AUTH-006 | 401 | 인증이 필요합니다 |
| AUTH-007 | 403 | 접근 권한이 없습니다 |
| USER-001 | 404 | 사용자를 찾을 수 없습니다 |
| USER-002 | 409 | 이미 존재하는 사용자입니다 |
| USER-003 | 409 | 이미 사용 중인 이메일입니다 |
| USER-004 | 409 | 이미 사용 중인 사용자명입니다 |
| USER-005 | 403 | 차단된 사용자입니다 |
| USER-006 | 403 | 탈퇴한 사용자입니다 |
| USER-007 | 403 | 이메일 인증이 필요합니다 |
| VERIFICATION-001 | 404 | 인증 정보를 찾을 수 없습니다 |
| VERIFICATION-002 | 400 | 인증 코드가 만료되었습니다 |
| VERIFICATION-003 | 400 | 유효하지 않은 인증 코드입니다 |
| VERIFICATION-004 | 400 | 이미 사용된 인증 코드입니다 |
| CHANNEL-001 | 404 | 채널을 찾을 수 없습니다 |
| CHANNEL-002 | 409 | 이미 등록된 채널입니다 |
| CHANNEL-003 | 400 | 유효하지 않은 채널 ID입니다 |
| SUBSCRIPTION-001 | 404 | 구독 정보를 찾을 수 없습니다 |
| SUBSCRIPTION-002 | 409 | 이미 구독한 채널입니다 |
| SUBSCRIPTION-003 | 400 | 구독 가능한 채널 수를 초과했습니다 |
| SUBSCRIPTION-004 | 400 | 구독하지 않은 채널입니다 |
| REFERENCE-001 | 404 | 레퍼런스를 찾을 수 없습니다 |
| REFERENCE-002 | 400 | 레퍼런스 개수 제한을 초과했습니다 |
| TAG-001 | 404 | 태그를 찾을 수 없습니다 |
| TAG-002 | 409 | 이미 존재하는 태그입니다 |
| TAG-003 | 400 | 태그 개수 제한을 초과했습니다 |
| TAG-004 | 404 | 태그 연결을 찾을 수 없습니다 |
| TAG-005 | 409 | 이미 연결된 태그입니다 |
| COMMON-002 | 404 | 요청한 리소스를 찾을 수 없습니다 |
| COMMON-003 | 400 | 잘못된 요청입니다 |
| COMMON-004 | 409 | 이미 존재하는 리소스입니다 |
| COMMON-005 | 429 | 요청이 너무 많습니다. 고객센터로 문의해주세요 |
</details>

> 주의: GLOBAL 에러의 serverMessage는 클라이언트에 노출되지 않으며, 로그 및 모니터링용으로만 사용됩니다.
