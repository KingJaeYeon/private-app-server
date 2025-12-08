# 🏗️ Private App Server

NestJS 기반 백엔드 서버 프로젝트입니다.

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [핵심 컨벤션](#핵심-컨벤션)
- [개발 가이드](#개발-가이드)
- [모듈 상태](#모듈-상태)

---

## 프로젝트 개요

이 프로젝트는 **유튜브 채널 데이터를 수집·관리·분석**하고, 태그 및 구독 정보를 기반으로 "내게 의미 있는 채널"을 발견하고 관리할 수 있게 해주는 서비스의 백엔드입니다.

### 주요 기능

- 📺 **채널 관리**: YouTube 채널 메타데이터 저장 및 조회
- 📊 **히스토리 추적**: 채널 성장 지표 시계열 데이터 수집
- 🔖 **태그 시스템**: 폴리모픽 태그 관계를 통한 유연한 분류
- 👤 **구독 관리**: 사용자별 채널 구독 및 관리
- 🔐 **인증 시스템**: JWT 기반 인증 및 이메일 인증
- 🌐 **Public API**: 인증 없이 접근 가능한 공개 엔드포인트

---

## 기술 스택

### 핵심 기술

- **프레임워크**: NestJS 11.x
- **언어**: TypeScript 5.7
- **데이터베이스**: PostgreSQL
- **ORM**: Prisma 7.x
- **인증**: JWT (Access/Refresh Token, Cookie 기반)

### 주요 라이브러리

- **문서화**: Swagger/OpenAPI (JSDoc 기반 자동 생성)
- **스케줄링**: @nestjs/schedule
- **보안**: Helmet, Throttler (Rate Limiting), Blacklist
- **검증**: class-validator, class-transformer

---

## 프로젝트 구조

```
src/
├── app.module.ts          # 루트 모듈
├── main.ts                # 애플리케이션 진입점
│
├── common/                # 공통 모듈
│   ├── constants/         # 상수 정의
│   ├── decorators/        # 커스텀 데코레이터
│   ├── dto/              # 공통 DTO
│   ├── exceptions/       # 에러 처리
│   ├── filters/          # Exception Filter
│   ├── guards/           # Guard
│   ├── helper/           # 헬퍼 함수
│   ├── interceptors/     # Interceptor
│   ├── interface/        # 공통 인터페이스
│   └── util/             # 유틸리티
│
├── config/               # 설정 관리 (YAML 기반)
├── core/                 # 핵심 서비스 (Prisma, ErrorLogging)
├── generated/            # Prisma 생성 파일
│
└── modules/              # 기능 모듈
    ├── auth/            ✅ 1사이클 
    ├── youtube/         ✅ 1사이클
    ├── public/          ✅ 완성
    ├── channels/        🚧 부분 완성
    ├── tags/            🚧 부분 완성
    ├── references/      🚧 기본 구조만
    └── users/           🚧 기본 구조만
```

---

## 핵심 컨벤션

### 1. 인터페이스 네이밍

**필수 규칙**: 모든 인터페이스는 `I` 접두사를 사용해야 합니다.

```typescript
// ✅ 올바른 예
interface IErrorResponse {
  code: string;
  message: string;
}

// ❌ 잘못된 예
interface ErrorResponse {
  code: string;
  message: string;
}
```

**예외**: Type alias는 `I` 접두사를 사용하지 않습니다.
- `type ErrorCode = string`
- `type ErrorDefinition = {...}`

### 2. 데이터베이스 네이밍

**필수 규칙**: 모든 테이블과 컬럼은 `snake_case`를 사용해야 합니다.

```prisma
// ✅ 올바른 예
model User {
  id            String   @id
  emailVerified DateTime? @map("email_verified")
  createdAt     DateTime  @default(now()) @map("created_at")
  
  @@map("users")
}

// ❌ 잘못된 예
model User {
  emailVerified DateTime? // camelCase 사용 금지
  createdAt     DateTime  // camelCase 사용 금지
}
```

**이유**: AWS RDS 마이그레이션 제약 및 데이터베이스 대소문자 일관성을 위해 필수입니다.

### 3. 에러 처리

**필수 규칙**: 모든 비즈니스 로직 에러는 `CustomException`을 사용해야 합니다.

```typescript
// ✅ 올바른 예
throw new CustomException('USER_NOT_FOUND', { userId: '123' });

// ❌ 잘못된 예
throw new Error('User not found');
throw new HttpException('User not found', 404);
```

**에러 코드 구조**:
- `GLOBAL_ERROR_CODES`: 시스템 레벨 에러 (INTERNAL_SERVER_ERROR, DATABASE_ERROR 등)
- `BASE_ERROR_CODES`: 비즈니스 로직 에러 (USER_NOT_FOUND, CHANNEL_NOT_FOUND 등)

**중요**: `serverMessage`는 로깅 전용이며, 클라이언트에는 절대 노출하지 않습니다.

### 4. 응답 형식 표준화

**성공 응답**:
```typescript
{
  success: true,
  data?: T,
  timestamp: string
}
```

**에러 응답**:
```typescript
{
  success: false,
  statusCode: number,
  code: string,
  message: string,
  details?: any,
  timestamp: string,
  path: string
}
```

**Response DTO 규칙**:

1. **GET 요청**: Response DTO 사용 필수
   - Prisma 타입에서 파생하여 사용
   - BigInt → string/number 변환 필수
   - JSDoc `@example`로 문서화

2. **POST/PATCH/DELETE (단일 작업)**: Response DTO 사용 금지
   - 반환 형식: `{ id?: number | string, message?: string }`
   - 예: `return { id: subscriptionId, message: '구독이 완료되었습니다.' }`

3. **POST/PATCH/DELETE (Bulk 작업)**: Response DTO 사용 금지
   - 반환 형식: `{ count: number }`
   - 하나라도 실패하면 에러를 던지고 DB 트랜잭션으로 전체 롤백

### 5. 의존성 주입

**필수 규칙**: Constructor injection만 사용하고, 모든 의존성은 `private readonly`로 선언합니다.

```typescript
// ✅ 올바른 예
@Injectable()
export class ChannelsService {
  constructor(
    private readonly db: PrismaService,
    private readonly configService: ConfigService<IConfigKey>
  ) {}
}

// ❌ 잘못된 예
@Injectable()
export class ChannelsService {
  @Inject(PrismaService)
  private db: PrismaService; // Property injection 금지
}
```

### 6. 파일 네이밍

**필수 규칙**: 다음 접미사를 정확히 따라야 합니다.

- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Modules: `*.module.ts`
- Guards: `*.guard.ts`
- Decorators: `*.decorator.ts`
- DTOs: `*.dto.ts`
- Strategies: `*.strategy.ts`
- Utilities: `*.util.ts`
- Tests: `*.spec.ts`

### 7. 폴리모픽 관계 (TagRelation) 최적화

**필수 규칙**: N+1 쿼리 문제를 방지하기 위해 배치 쿼리를 사용해야 합니다.

```typescript
// ✅ 올바른 예: 배치 쿼리
const relations = await db.tagRelation.findMany({
  where: { taggableId: { in: [1, 2, 3] } }
});

// ✅ 올바른 예: 병렬 쿼리
const [channelTags, referenceTags] = await Promise.all([
  db.tagRelation.findMany({ where: { taggableType: 'CHANNEL', taggableId: { in: channelIds } } }),
  db.tagRelation.findMany({ where: { taggableType: 'REFERENCE', taggableId: { in: referenceIds } } })
]);

// ❌ 잘못된 예: N+1 문제
for (const item of items) {
  const tags = await db.tagRelation.findMany({ where: { taggableId: item.id } });
}
```

---

## 개발 가이드

### 새 모듈 추가하기

1. `modules/{feature}/` 디렉토리 생성
2. `{feature}.module.ts`, `{feature}.controller.ts`, `{feature}.service.ts` 생성
3. `dto/` 디렉토리에 DTO 생성
4. `app.module.ts`에 모듈 추가
5. 필요 시 `error-code.ts`에 에러 코드 추가
6. Swagger 문서화 추가
7. 테스트 파일 (`.spec.ts`) 생성

### 새 엔드포인트 추가하기

1. Controller에 라우트 핸들러 추가
2. Service에 비즈니스 로직 추가
3. DTO 생성/수정
4. `@ApiActionResponse()` 또는 `@ApiGetResponse()` 및 `@ApiErrorResponses()` 추가
5. Public 엔드포인트인 경우 `@Public()` 데코레이터 추가
6. `CustomException`으로 에러 처리
7. 표준 응답 형식 반환

### 페이지네이션 구현

**필수 규칙**: GET 엔드포인트에서 배열을 반환하는 경우 페이지네이션을 구현해야 합니다.

```typescript
// Controller
@Get()
async getList(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
) {
  return this.service.getList(page, limit);
}

// Service
async getList(page: number, limit: number) {
  const maxLimit = Math.min(limit, 50); // 최대 50개
  const skip = (page - 1) * maxLimit;
  
  const [items, total] = await Promise.all([
    this.db.model.findMany({ skip, take: maxLimit }),
    this.db.model.count()
  ]);
  
  return {
    items,
    pagination: { total, page, limit: maxLimit, hasMore: skip + maxLimit < total }
  };
}
```

### Swagger 문서화

**필수 규칙**: `@ApiProperty` 데코레이터를 사용하지 않고, JSDoc `@example`만 사용합니다.

```typescript
// ✅ 올바른 예
export class SignUpDto {
  /**
   * 이메일 주소
   * @example "user@example.com"
   */
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

// ❌ 잘못된 예
export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

**이유**: `nestjs-cli.json`의 Swagger 플러그인이 `classValidatorShim: true`와 `introspectComments: true`로 설정되어 있어 자동으로 Swagger 스키마를 생성합니다.

---

## 모듈 상태

### 완성된 모듈 ✅

- **Auth Module**: 이메일 인증, JWT 토큰, Rate Limiting 완전 구현
- **YouTube Module**: API 통합, 키 관리, 스케줄러, 쿼터 관리 완전 구현
- **Public Module**: 인증 없이 접근 가능한 엔드포인트 완전 구현
- **Channels Module**: 채널 관리, 히스토리, 구독 기능 완전 구현
  - `SubscriptionService` 및 `SubscriptionsController` 포함 (엔드포인트: `/channels/subscriptions`)
  - `ChannelHistoriesService`로 채널 지표 추적
- **Tags Module**: 태그 관리 및 TagRelation 지원 (CHANNEL 타입) 완전 구현

### 부분 구현 모듈 🚧

- **Users Module**: 기본 구조만 존재
- **References Module**: 기본 구조만 존재 (Prisma 모델 존재, 기본 CRUD 구현)

### 미구현 모듈 ❌

- **Prompts Module**: Prisma 모델은 존재하지만 모듈 미생성
  - 참고: `TaggableType` enum은 현재 `REFERENCE`와 `CHANNEL`만 지원
  - Phase 6에서 `PROMPT` 타입 추가 예정

---

## 주요 공통 모듈

### Response Interceptor

모든 HTTP 응답을 표준 형식으로 자동 변환합니다. `@SkipResponseTransform()` 데코레이터로 예외 처리 가능합니다.

### AllExceptionsFilter

모든 예외를 표준 에러 응답으로 변환하고, Prisma 에러를 자동 매핑합니다 (P2002 → 중복, P2025 → Not Found 등).

### 커스텀 데코레이터

- `@Public()`: 인증 없이 접근 가능한 엔드포인트
- `@CurrentUser()`: JWT에서 사용자 정보 추출
- `@ClientInfo()`: IP, User-Agent 추출
- `@ApiActionResponse()`: POST/PATCH/DELETE Swagger 문서화
- `@ApiGetResponse()`: GET Swagger 문서화
- `@ApiErrorResponses()`: 에러 응답 문서화

---

## 보안

### Cookie 보안

- `httpOnly: true`: JavaScript 접근 차단
- `secure: true`: 프로덕션 환경에서 HTTPS만 허용
- `sameSite`: Access Token은 `'lax'`, Refresh Token은 `'strict'`

### Rate Limiting

- Public 엔드포인트에 Rate Limiting 적용
- 이메일 인증은 IP 기반 Rate Limiting
- 과도한 요청 시 Blacklist 자동 등록

### 입력 검증

- 모든 입력은 `class-validator`로 검증
- `ValidationPipe`에 `whitelist: true`와 `forbidNonWhitelisted: true` 설정
- 클라이언트 입력을 절대 신뢰하지 않음

---

## 코드 스타일

### Prettier 설정

- 세미콜론: 필수
- Trailing comma: 없음
- Quotes: 작은따옴표
- 줄 너비: 120자
- 탭 너비: 2칸

### Import 순서

1. NestJS 공식 모듈
2. 외부 라이브러리
3. 프로젝트 내부 모듈 (`@/` 경로 별칭)
4. 상대 경로
5. Type-only imports

### 네이밍 컨벤션

- **Classes**: PascalCase (`AuthService`, `CustomException`)
- **Interfaces**: `I` + PascalCase (`IErrorResponse`, `IConfigKey`)
- **Variables/Functions**: camelCase (`errorResponse`, `buildErrorResponse`)
- **Constants**: UPPER_SNAKE_CASE (`ERROR_CODES`, `AUTH_COOKIE`)
- **Boolean**: `is`, `has`, `should` 접두사 (`isBlacklisted`, `hasPermission`)

---

## 주의사항

### 절대 하지 말아야 할 것들

1. **N+1 쿼리**: 반복문 내부에서 DB 쿼리 금지
2. **타입 안전성**: `any` 사용 최소화
3. **보안**: 민감 정보 클라이언트 노출 금지
4. **코드 중복**: 공통 로직은 유틸리티로 추출
5. **순환 의존성**: 모듈 간 순환 참조 금지

### 코드 리뷰 체크리스트

코드 제출 전 다음 사항을 확인하세요:

- ✅ 모든 인터페이스에 `I` 접두사
- ✅ 모든 데이터베이스 이름이 `snake_case`
- ✅ 모든 에러가 `CustomException`과 에러 코드 사용
- ✅ 모든 응답이 표준 형식 준수
- ✅ N+1 쿼리 문제 없음
- ✅ `any` 타입 최소 사용
- ✅ 프로덕션 코드에 `console.log` 없음
- ✅ 모든 import가 경로 별칭 사용
- ✅ 모든 의존성이 `private readonly`
- ✅ 모든 Public 엔드포인트에 `@Public()` 데코레이터
- ✅ 모든 DTO에 검증 데코레이터 및 JSDoc 예시
- ✅ 모든 에러 코드가 `error-code.ts`에 정의됨

---

## 핵심 원칙

1. **타입 안전성 우선**: TypeScript의 타입 시스템을 효과적으로 활용
2. **일관성 유지**: 확립된 패턴을 따르기
3. **보안 중요**: 민감한 데이터를 절대 노출하지 않기
4. **성능 고려**: N+1 문제 방지, 배치 쿼리 사용
5. **유지보수성**: 명확하고 문서화된 코드 작성
6. **테스트 가능성**: 테스트하기 쉬운 코드 설계

---

## 더 자세한 정보

프로젝트의 상세한 규칙과 컨벤션은 `.cursorrules.mdc` 파일을 참고하세요.
