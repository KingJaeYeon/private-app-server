# Domain-based Dev Process

> 목적  
> “새 기능 만들 때마다 어떻게 진행할지”를 매번 고민하지 않도록,  
> **도메인별로 반복해서 사용할 수 있는 고정 작업 루틴**을 정의한다.

---

## 1. 이 문서에서 다루지 않는 것들

이미 전역에서 결정된 것들은 이 문서에서 다시 논의하지 않는다.

- 기술 스택
    - NestJS 11.x, TypeScript, Prisma, PostgreSQL, JWT
- 전역 규칙
    - 에러: `CustomException` + `ERROR_CODES`
    - 응답: `{ success, data, timestamp }` 표준 래핑
    - DB: 테이블/컬럼 모두 `snake_case`
    - 인터페이스: 항상 `I` prefix (`IConfigKey`, `IJwtPayload` 등)
    - DTO: `class-validator` + JSDoc `@example` (Swagger 플러그인 자동 생성)
- 공통 인프라
    - Global Exception Filter, Logger, Config, Auth 모듈 등
- **응답 포맷**
    - 전역 `ResponseInterceptor`가 HTTP 응답을 아래 형식으로 자동 래핑한다.
        - 성공:
          ```json
          {
            "success": true,
            "data": {},
            "timestamp": "..."
          }
          ```
        - 컨트롤러에서는 **raw data만 반환**하면 된다.
        - `@SkipResponseTransform()`(=`SKIP_RESPONSE_TRANSFORM`)이 붙은 핸들러는 래핑 제외.

즉, 이 문서의 목표는:

> “아키텍처를 다시 설계하는 게 아니라,  
> **도메인별 기능을 어떤 순서로 구현할지 정해놓고 그대로 따라가는 것**”

---

## 2. 전체 프로세스 한 줄 요약

새 기능(도메인/기능 세트)을 만들 때마다 **아래 6단계 루프를 반복**한다.

> **도메인/기능 세트 선택 →  
> 기능 미니 명세서(1페이지) →  
> 엔드포인트 목록 →  
> Prisma & DTO →  
> Service / Helper / Controller →  
> 테스트 & Swagger 확인**

이 6단계 루프가 이 프로젝트의 **기본 개발 프로세스**다.

---

## 3. STEP 0 – 도메인 & 기능 세트 선택 (Vertical Slice)

### 3.1 도메인 선택

먼저, 상위 도메인들 중 하나를 고른다.

- 예시
    - `Channels`
    - `ChannelHistory`
    - `Subscriptions`
    - `Tags`
    - `References`
    - `Prompts`
    - `ApiKeys`
    - …

### 3.2 도메인 안에서 “기능 세트” 하나만 선택

한 번에 도메인 전체를 끝내려고 하지 않고, **기능 세트(Vertical Slice)** 단위로 끊는다.

- 예시 (`Channels` 도메인)
    - 세트 A: 채널 등록 + 목록 조회 + 상세 조회
    - 세트 B: 채널 수정 + 삭제
    - 세트 C: 채널 검색/필터링
    - 세트 D: 채널 구독/해제 (Subscription 기능)
- 예시 (`Subscriptions` 기능 - Channels 모듈 내부)
    - 세트 A: 채널 구독/해제 + 중복 방지
    - 세트 B: 내 구독 목록 조회 + 페이지네이션
    - **참고**: Subscription은 Channels 모듈 내부에 구현되어 있으며, 엔드포인트는 `/channels/subscriptions`입니다.

> 핵심: “오늘/이번 주에 끝낼 **기능 세트 하나**”를 고르는 것이 STEP 0.

---

## 4. STEP 1 – 기능 미니 명세서 (1페이지 문서)

UI 기준이 아니라, **도메인/기능 기준**으로만 작성하는 짧은 스펙.  
`src/docs/domain-*.md` 같은 위치에 저장한다. (예: `domain-channels.md`)

### 4.1 미니 명세서 템플릿 (예: Channels)

```md
# [Feature] Channels – 기본 관리 기능

## 1. 목적
- 사용자가 구독/분석할 유튜브 채널을 저장하고 관리한다.

## 2. 대상 유저 / 권한
- 로그인한 사용자만 접근 가능
- 본인이 추가한/구독한 채널만 수정/삭제 가능
- 일부 조회는 Public API로 공개 가능

## 3. 시나리오 (User Flow)
1) 사용자는 채널 URL/handle을 입력해 채널을 등록한다.
2) 등록된 채널 목록을 조회한다. (검색/페이지네이션)
3) 채널 상세 페이지에서 메타 정보와 성장 히스토리를 확인한다.
4) 필요하면 태그/메모를 수정한다.
5) 더 이상 필요 없는 채널은 삭제한다.

## 4. 엔티티(초안)
- Channel
  - id: number
  - channel_id: string
  - name: string
  - handle: string | null
  - description: string | null
  - link: string
  - thumbnail_url: string | null
  - view_count: bigint
  - subscriber_count: number
  - video_count: number
  - published_at: Date
  - created_at: Date
  - updated_at: Date

## 5. 비즈니스 규칙
- channel_id는 전역 유니크
- 동일한 channel_id를 중복 등록할 수 없다.
- 삭제는 소프트 삭제가 아닌 하드 삭제 (MVP 기준)
- 목록 기본 정렬은 created_at DESC
```
이 문서까지 작성하면 UI가 없어도 해당 도메인의 의도와 범위를 이해할 수 있다.

---

## 5. STEP 2 – 엔드포인트 목록 정의

STEP 1에서 작성한 미니 명세서에서 **API 계약(Contract)**을 뽑는다.  
이 내용은 나중에 프론트와 협의할 때도 기준이 된다.

### 5.1 엔드포인트 템플릿 (예: Channels)

## 6. 엔드포인트 목록

```md
1) 채널 등록
- METHOD: POST
- PATH: /channels
- AUTH: JWT 필요
- REQUEST BODY:
    - handle: string  // 또는 channel URL
- RESPONSE: { id?: number, message?: string }
- ERROR:
    - CHANNEL_ALREADY_EXISTS
    - YOUTUBE_CHANNEL_NOT_FOUND

2) 채널 목록 조회
- METHOD: GET
- PATH: /channels
- AUTH: JWT 필요
- QUERY:
    - page?: number (default: 1)
    - limit?: number (default: 20, max: 50)
    - keyword?: string
- RESPONSE:
    - items: ChannelResponseDto[]
    - pagination: { total, page, limit, hasMore }

3) 채널 상세 조회
- METHOD: GET
- PATH: /channels/:id
- AUTH: JWT 필요
- RESPONSE: ChannelDetailResponseDto

4) 채널 수정
- METHOD: PATCH
- PATH: /channels/:id
- RESPONSE: { id?: number, message?: string }

5) 채널 삭제
- METHOD: DELETE
- PATH: /channels/:id
- RESPONSE: { id?: number, message?: string }

6) 채널 구독 (Bulk)
- METHOD: POST
- PATH: /channels/subscriptions
- AUTH: JWT 필요
- REQUEST BODY:
    - handles: string[]
- RESPONSE: { count: number }
- ERROR: 하나라도 실패하면 에러 발생 및 전체 롤백

7) 내 구독 목록 조회
- METHOD: GET
- PATH: /channels/subscriptions
- AUTH: JWT 필요
- QUERY:
    - tagIds?: number[]
    - page?: number
    - limit?: number
- RESPONSE: SubscriptionResponseDto[]

8) 구독 해제 (Bulk)
- METHOD: DELETE
- PATH: /channels/subscriptions
- AUTH: JWT 필요
- REQUEST BODY:
    - subscriptionIds: number[]
- RESPONSE: { count: number }
- ERROR: 하나라도 실패하면 에러 발생 및 전체 롤백
```
이 단계까지 오면, NestJS 코드는 **이 스펙을 “그대로 구현하는 작업”**으로 바뀐다.

---

## 6. STEP 3 – Prisma 모델 & DTO 설계

이제 코드 레벨 설계 구간.

### 6.1 Prisma 모델 체크/수정

- `schema.prisma`에서 해당 도메인 모델을 확인/수정한다.
- 규칙:
  - 테이블/컬럼 이름은 모두 `snake_case`
  - 관계(`@relation`)와 onDelete 정책을 명확히 설정
  - 자주 조회되는 필드는 `@@index` 추가
- Phase별로 최소 필드만 먼저 도입하고, 이후 확장 가능.

### 6.2 DTO 설계

- Request DTO
  - class + `class-validator` + JSDoc `@example`
  - `@ApiProperty` 사용 금지 (JSDoc 기반 Swagger)
- Response DTO
  - **GET 요청만 Response DTO 사용**
    - Prisma 타입에서 `Omit`/`Pick`으로 파생
    - BigInt → string 변환을 타입으로 반영
    - JSDoc `@example`로 문서화
  - **POST/PATCH/DELETE 요청은 Response DTO 사용하지 않음**
    - `{ id?: number | string, message?: string }` 형식으로 반환
    - `id`와 `message` 모두 optional

```ts
// create-channel.dto.ts
export class CreateChannelDto {
  /** 유튜브 채널 핸들 또는 URL @example "@fireship_dev"*/
  @IsString()
  @IsNotEmpty()
  handle: string;
}
```
```ts
// channel-response.dto.ts
import { Channel } from '@generated/prisma/client';

type ChannelWithStringViewCount = Omit<Channel, 'viewCount'> & {
  viewCount: string;
};

export class ChannelResponseDto implements ChannelWithStringViewCount {
  /** 채널 ID @example 1*/
  id: number;

  /** 채널명 @example "Fireship"*/
  name: string;

  /** 유튜브 채널 고유 ID @example "UCsBjURrPoezykLs9EqgamOA"*/
  channelId: string;

  /** 총 조회수 (BigInt → string) @example "708661464"*/
  viewCount: string;
  // ... 나머지 필드
}
```

---

## 7. STEP 4 – Service / Helper / Controller 구현
### 7.1 Service 상단 TODO 목록

서비스 파일 상단에 이 서비스가 담당할 유즈케이스 목록을 TODO로 먼저 작성한다.  
나중에 Cursor에 넘길 때 요구사항이 되기도 한다.

```ts
/**
 * [Feature] Channels
 * - 유저별 YouTube 채널 관리
 */

// TODO: (1) createChannel(userId, dto)
// TODO: (2) getChannels(userId, page, limit, keyword?)
// TODO: (3) getChannelDetail(userId, channelId)
// TODO: (4) updateChannel(userId, channelId, dto)
// TODO: (5) deleteChannel(userId, channelId)
@Injectable()
export class ChannelsService {
  constructor(
    private readonly db: PrismaService,
  ) {}
}
```
### 7.2 함수 내부를 단계별 TODO로 쪼개기
```ts
async createChannel(userId: string, dto: CreateChannelDto): Promise<ChannelResponseDto> {
  // TODO: handle / URL에서 channelId 추출 (YoutubeHelperService로 위임)
  // TODO: userId + channelId 중복 여부 확인
  // TODO: YouTube API에서 채널 메타데이터 조회 (이름, 썸네일 등)
  // TODO: Prisma channel create 또는 upsert
  // TODO: Response DTO로 매핑 후 반환
}
```
이렇게 해두면:
- Cursor에게 “위 TODO를 만족하도록 구현해줘”라고 쉽게 전달 가능
- 나중에 코드를 읽을 때도 의도와 흐름을 한눈에 이해할 수 있다.

### 7.3 Helper Service 분리 기준
- 외부 API 호출, 파싱, 공통 변환 로직, 복잡한 쿼리는  
`ChannelsHelperService`, `YoutubeHelperService` 같은 내부 전용 서비스로 분리.
- 규칙:
  - 모듈 내부에서만 사용하는 경우 `providers`에는 등록하되 `exports`에는 추가하지 않는다.
  - 다른 모듈에서 재사용 필요할 때만 `exports`에 노출한다.

### 7.4 Controller의 역할

Controller는 최대한 얇게 유지:
- DTO 바인딩 (@Body, @Query, @Param)
- @CurrentUser(), @ClientInfo()로 컨텍스트 추출
- Service 호출
- **응답 래핑은 하지 않고, raw data만 반환**
  - 전역 ResponseInterceptor가 { success, data, timestamp } 형식으로 자동 래핑
  - SSE/파일 다운로드 등 “그대로 보내야 하는 경우”에만 @SkipResponseTransform() 사용

```ts
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  async create(
    @CurrentUser() user: IJwtPayload,
    @Body() dto: CreateChannelDto,
  ) {
    const data = await this.channelsService.createChannel(user.id, dto);

    return data;
  }

  @Get()
  async list(
    @CurrentUser() user: IJwtPayload,
    @Query() dto: ChannelListDto,
  ) {
    const data = await this.channelsService.getList(user.id, page, limit);

    return data;
  }
}
```

---

## 8. STEP 5 – 테스트 & Swagger 확인

TDD를 강제하진 않지만, 최소한 이 정도는 항상 확인한다.

### 8.1 Service 단위 테스트

- 각 서비스에 대해 `.spec.ts` 파일을 둔다.  
- `PrismaService` 등 외부 의존성은 mock으로 교체.
- 최소 케이스:
  - 정상 동작 (happy path)
  - 대표적인 비즈니스 에러 케이스 1~2개

```ts
describe('ChannelsService', () => {
  it('채널이 이미 존재하면 CHANNEL_ALREADY_EXISTS 에러를 던진다', async () => {
    // ...
  });
});
```

### 8.2 Postman / Thunder Client 시나리오 테스트

실제 서버를 띄워서 아래 케이스를 호출해본다.

- 성공 케이스
  - DTO Validation 실패
  - 권한 실패 (로그인 안 함, 다른 유저 리소스 접근 등)
  - 비즈니스 규칙 실패 (중복, 잘못된 상태 등)
- Swagger UI에서는:
  - 스키마가 의도대로 생성되는지
  - JSDoc @example이 잘 노출되는지
  - 응답 포맷이 전역 규칙과 일치하는지 

를 눈으로 확인한다.

---

## 9. 하루 작업 루틴 예시

이 프로세스를 실제 하루 단위에 적용하면 흐름은 다음과 같다.

**1. 오늘 처리할 도메인/기능 세트 결정**
- 예: `Channels` – 채널 등록 + 목록/상세 조회

**2. 해당 도메인의 미니 명세서 업데이트**
- 목적/시나리오/엔티티/규칙 재점검

**3. 그에 맞는 엔드포인트 목록 작성/수정**

**4. Prisma 모델 & DTO** 확인/보완

**5.** Service/Helper/Controller에 **TODO 목록 작성**

**6. Cursor/에디터로 구현 진행 + 코드 리뷰**

**7. Postman/Swagger로 기능 검증**

**8. 필요하면 간단한 Service 단위 테스트 추가**

이 루틴을 매일/매주 반복하면:
- “무엇부터 할지”에 대한 고민이 줄고,
- 프로젝트 전체는 자연스럽게 Phase 1 → 2 → 3 … 순서로 완성된다.