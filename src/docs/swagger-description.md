<a href="swagger/json" download="api-docs.json">api-docs.json</a>

<a href="swagger/yaml" download="api-docs.yaml">api-docs.yaml</a>

## 🎯 API 개요 (Overview)

이 문서는 Private App 의 주요 백엔드 API 명세입니다. 클라이언트(웹/모바일)가 서버와 통신하는 데 필요한 모든 엔드포인트, 데이터 모델, 그리고 인증 메커니즘을 정의합니다.



### 주요 기능

* {기능 1}: 간결하게 설명

* {기능 2}: 간결하게 설명

* {기능 3}: 간결하게 설명



## 🔒 인증 (Authentication)

이 API는 **쿠키(Cookie)**를 기반으로 하는 세션 및 토큰 인증 방식을 사용합니다.

<details><summary>상세보기</summary>

### 1. 액세스 토큰 (Access Token)

* **쿠키 이름:** access_token

* **역할:** 모든 보호된 API 엔드포인트에 접근하기 위해 사용됩니다. 토큰의 유효 기간은 비교적 짧습니다.

* **만료 시 동작:** 토큰이 만료되면, 클라이언트는 자동으로 리프레시 토큰을 사용하여 새 액세스 토큰을 요청해야 합니다.

### 2. 리프레시 토큰 (Refresh Token)

* **쿠키 이름:** refresh_token

* **역할:** 액세스 토큰이 만료되었을 때, 새 액세스 토큰을 발급받기 위해 사용됩니다.

* **보안:** 보안을 위해 HTTP Only 쿠키로 설정되어 자바스크립트 접근이 불가능합니다.</details>




## 📋 성공 응답 구조 (JSON)

모든 성공 응답은 TypeScript 인터페이스 `SuccessResponse<T>`를 기반으로 합니다.

```json
{
  "success": true,
  "data": T,
  "timestamp": string
}
```
<details>
<summary>💡 필드 설명</summary>

| 필드 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :--- | :--- |
| success | boolean (true로 고정) | 필수 | 요청 처리가 **성공적**이었음을 나타내는 플래그입니다. |
| data | T (제네릭) | 선택적 | 요청의 **핵심 결과 데이터**입니다. 데이터 구조는 엔드포인트에 따라 달라집니다. |
| timestamp | string | 필수 | 서버에서 응답이 생성된 **UTC 시간**입니다. (ISO 8601 형식) |
</details>





## ⚠️실패시 응답 구조 (JSON)

모든 응답은 TypeScript 인터페이스 `ErrorResponse`를 기반으로 합니다.

```json
{
  "success": false;
  "statusCode": number;
  "code": string;
  "message": string;
  "details": any | undefined;
  "timestamp": string;
  "path": string;
  "category": 'GLOBAL' | 'BASE';
}
```
<details>
<summary>⚠️ 실패 응답 필드 설명</summary>

| 필드 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :--- | :--- |
| success | boolean (false로 고정) | 필수 | 요청 처리가 **실패**었음을 나타내는 플래그입니다. |
| statusCode | number | 필수 | 요청 처리가 **실패**었음을 나타내는 플래그입니다. 클라이언트 오류(4xx) 또는 서버 오류(5xx)를 나타냅니다.|
| code | string | 필수 | 애플리케이션 정의 **고유 오류 식별 코드**입니다. 클라이언트가 에러 타입을 구분하는 데 사용됩니다.|
| message | string | 필수 | 오류에 대한 간결하고 사람이 읽을 수 있는 **상세 설명**입니다.|
| details | any or undefined | 선택적 | **(선택적)** 오류 유형에 따라 추가적인 디버깅 정보를 담습니다. 유효성 검사 실패 시 유용합니다.|
| timestamp | string | 필수 | 서버에서 응답이 생성된 **UTC 시간**입니다. (ISO 8601 형식) |
| path | string | 필수 | 에러를 발생시킨 **요청 URL 경로**입니다. |
</details>




## 🌐 Global & Base Error Codes Documentation

서비스 API에서 발생 가능한 모든 오류 코드.

<details>
<summary>🏷 GLOBAL Errors</summary>

| Code | HTTP Status | Message | serverMessage |
|------|------------|---------|---------------|
| INTERNAL-001 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Unhandled internal error. |
| INTERNAL-002 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요 | Prisma connection issue: $prisma_code |
| INTERNAL-003 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Database error occurred: $prisma_code |
| INTERNAL-004 | 503 | 서비스를 일시적으로 이용할 수 없습니다. | External service unavailable. |
| INTERNAL-005 | 500 | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Prisma validation failed before executing SQL |
| INTERNAL-006 | 409 | 중복된 데이터입니다 | P2002 Unique constraint failed on: $field |
| INTERNAL-007 | 404 | 요청한 데이터를 찾을 수 없습니다 | P2025 Record not found |
| GLOBAL-001 | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. | Rate limit exceeded. |
| GLOBAL-002 | 403 | 요청을 처리할 수 없습니다. 관리자에게 문의하세요. | Blocked by security policy – IP blacklisted. |
| GLOBAL-004 | 500 | 요청을 처리할 수 없습니다. | Unexpected HttpException occurred. |
</details>

<details>
<summary>🏷 BASE Errors</summary>

| Code | HTTP Status | Message |
|------|------------|---------|
| INTERNAL-008 | 400 | 잘못된 참조입니다 |
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

주의: GLOBAL 에러의 serverMessage는 클라이언트에 노출되지 않으며, 로그 및 모니터링용으로만 사용됩니다.
