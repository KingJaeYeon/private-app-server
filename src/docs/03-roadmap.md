# Project Roadmap (Phase 1 ~ 7)

> 목적  
> 전체 기능을 한 번에 구현하려고 하지 않고,  
> **단계(Phase)** 별로 범위를 나눠서 순차적으로 완성해 나가기 위한 로드맵.

이 문서는 “무엇을 언제 만들 것인지”에 대한 **상위 계획**만 다룬다.  
각 Phase 안에서 실제 구현은 `02-dev-process.md`의 6단계 루틴을 따른다.

---

## 0. Overview

### 0.1 목표

이 프로젝트는 다음 세 축을 갖는 백엔드 서비스를 지향한다.

1. **유튜브 채널/히스토리 데이터 수집 및 분석**
2. **유저 구독/태그 기반의 탐색·추천**
3. **외부 API/AI 기반의 콘텐츠 생성 파이프라인**

이를 위해 전체 작업을 7개 Phase로 나눈다.

### 0.2 Phase 요약

- **Phase 1** – Channel / ChannelHistory / Public API (게스트도 볼 수 있는 데이터)
- **Phase 2** – Auth / User / Subscription (내 구독 채널 관리)
- **Phase 3** – Tag / TagRelation (우선 채널에만 적용)
- **Phase 4** – 내 구독 채널 + 성장 데이터 기반 “인기 채널 조회”
- **Phase 5** – UserApiKey / ApiUsage / Keyword Search
- **Phase 6** – Reference / Prompt + 태그 확장
- **Phase 7** – AI Job / Generation Pipeline / SSE

---

## Phase 1 – Channel / ChannelHistory / Public API

### 1. 목표

- **유저가 없어도 돌아가는 서비스의 뼈대**를 만든다.
- 유튜브 채널을 수집하고, 히스토리를 기록하고,  
  게스트에게 “최신 채널 10개 + 상세”를 Public API로 제공한다.

### 2. 포함 도메인

- `Channel`
- `ChannelHistory`
- `ApiKey` (type = SERVER)
- 스케줄러(배치) – 하루 1회 채널 히스토리 기록
- Public 전용 컨트롤러 (`/public/...`)

### 3. 주요 기능

- 서버 관리용 YouTube API Key를 이용해 **채널 정보 등록**
- 하루 1회(또는 설정된 주기)로 각 채널의
    - `viewCount`, `subscriberCount`, `videoCount` 등을 `ChannelHistory`에 기록
- Public API
    - `GET /public/channels` – 최신 채널 10개 목록
    - `GET /public/channels/:id` – 채널 메타데이터 + 최근 히스토리 일부

### 4. 제외 범위

- 유저/로그인/구독/태그
- 고급 통계/비교/추천
- 키워드 검색 / AI 기능

### 5. 완료 체크리스트

- [ ] Prisma: `channel`, `channel_history`, `api_keys` (SERVER용) 모델 확정
- [ ] 스케줄러 모듈에서 하루 1회 히스토리 수집 동작
- [ ] Public API 두 개 동작 및 Swagger 문서 노출
- [ ] 기본 에러/로깅/응답 포맷 일관성 확인

---

## Phase 2 – Auth / User / Subscription

### 1. 목표

- 로그인한 사용자가 **채널을 구독**하고,  
  “내 구독 채널 목록”을 볼 수 있는 상태까지 만든다.

### 2. 포함 도메인

- `User`, `Auth` (이미 어느 정도 구현된 모듈 보완)
- `Subscription` (Channels 모듈 내부에 구현)
- 인증/인가 Guard (`JwtAuthGuard`, `@CurrentUser()`)

### 3. 주요 기능

- 회원가입/로그인/로그아웃
- JWT 기반 인증
- 구독 기능
    - `POST /channels/subscriptions` – 채널 구독
    - `GET /channels/subscriptions` – 내 구독 채널 목록
    - `DELETE /channels/subscriptions` – bulk 삭제
- `user_id + channel_id` 유니크 제약으로 중복 구독 방지

**구현 참고**

- Subscription은 Channels 모듈 내부에 `SubscriptionService`와 `SubscriptionsController`로 구현되어 있습니다.
- 채널과 구독이 밀접하게 연관되어 있어 같은 모듈에 포함하는 것이 응집도 측면에서 적합합니다.

### 4. 제외 범위

- 구독 기반 추천/인기 채널 로직
- 태그/필터 기능
- 고급 보안(2FA, 소셜 로그인 등)

### 5. 완료 체크리스트

- [x] `User` ↔ `Subscription` relation 설정 및 마이그레이션
- [x] Auth 모듈과 Subscription 기능 연동 (Channels 모듈 내부)
- [x] "내 구독 목록" API에서 Channel 조인 정상 동작
- [x] 권한 체크(내 구독만 조회/삭제 가능) 테스트

---

## Phase 3 – Tag / TagRelation (채널 우선)

### 1. 목표

- **채널에 태그를 달고 관리할 수 있는 공통 태그 시스템**을 완성한다.
- 나중에 레퍼런스/프롬프트에도 같은 구조를 재사용할 수 있게 설계한다.

### 2. 포함 도메인

- `Tag`
- `TagRelation` (우선 `taggable_type = CHANNEL`)
- (기존 `Channel`, `Subscription`과 연동)

**구현 참고**

- Subscription에도 태그를 부착할 수 있으며, `taggable_type = CHANNEL`을 사용합니다.
- Subscription은 Channels 모듈 내부에 구현되어 있어 태그 기능도 자연스럽게 통합됩니다.

### 3. 주요 기능

- 태그 생성/조회/삭제(기본 관리)
- 채널에 태그 부착 / 제거
    - 태그가 없으면 `Tag` 생성 + `usage_count` 증가
    - `TagRelation`에 (tag, channel, user) 연결 레코드 추가
- 채널 상세/목록에서 태그 정보 확인

### 4. 제외 범위

- 프롬프트/레퍼런스/구독에 대한 태그 적용
- 태그 기반 추천/검색 고급 기능

### 5. 완료 체크리스트

- [x] Prisma: `tag`, `tag_relations` 모델 확인 (enum `TaggableType` 포함)
- [x] 채널 태그 CRUD API 구현 (`/channels/:id/tags` 등)
- [x] 태그 사용 횟수(usage_count) 증가 로직
- [x] N+1 방지: TagRelation 조회 시 항상 `IN` 기반 배치 쿼리 사용

---

## Phase 4 – 내 구독 채널 + 성장 데이터 기반 “인기 채널 조회”

### 1. 목표

- 유저가 구독 중인 채널들 중에서,
    - 태그/기간/성장률 기준으로 **“요즘 잘 나가는 채널”** 목록을 볼 수 있게 한다.
- 별도 추천 테이블 없이, 현 데이터 조합만으로 1차 버전을 만든다.

### 2. 포함 도메인

- `Subscription`
- `Channel`
- `ChannelHistory`
- `TagRelation` (채널용)

### 3. 주요 기능

- `GET /me/popular-channels` (가칭)
    - 대상: 내 구독 채널만
    - 옵션:
        - 기간: 예) 최근 7일/30일
        - 태그 필터: 선택한 태그들에 해당하는 채널만
    - 정렬:
        - 최근 기간 동안의 viewCount 증가량
        - 또는 현재 viewCount/구독자 수 기준

### 4. 제외 범위

- 별도 Recommendation/Popular 테이블
- 캐싱/배치 기반 랭킹 전처리
- A/B 테스트, 알고리즘 튜닝

### 5. 완료 체크리스트

- [ ] “내 구독 채널” ID 목록 조회 쿼리
- [ ] 선택 태그가 있을 경우 TagRelation로 필터링하는 쿼리
- [ ] ChannelHistory 기반 성장량 계산 쿼리
- [ ] 페이지네이션 + 정렬 + 최소 응답 속도 확인

---

## Phase 5 – UserApiKey / ApiUsage / Keyword Search

### 1. 목표

- 유저가 **본인의 YouTube API Key를 등록**하고,  
  해당 키로 키워드 검색을 수행할 수 있게 한다.
- 쿼터/사용량을 최소한으로 추적한다.

### 2. 포함 도메인

- `ApiKey` (type = USER)
- `ServerApiKeyUsage` 또는 별도 `ApiUsage` (쿼터 관리)
- Keyword Search 도메인/엔드포인트

### 3. 주요 기능

- 사용자 API 키 관리
    - `POST /me/api-keys`
    - `GET /me/api-keys`
    - `DELETE /me/api-keys/:id`
- 키워드 검색
    - `POST /search/keywords`
    - 유저 API 키 선택 → 유튜브 검색 → 결과 반환
- 사용량 기록
    - 날짜/유저/키별 사용량 카운트
    - 기본적인 하루 할당량/초과 처리

### 4. 제외 범위

- 매우 정교한 쿼터/요금제 시스템
- 검색 결과 캐싱/저장/랭킹
- 백그라운드 Job 기반의 대량 검색

### 5. 완료 체크리스트

- [ ] USER 타입 ApiKey 모델/제약 확인
- [ ] API 키 등록/삭제 시 Validation & 보안 처리
- [ ] Keyword Search에서 ApiKey 선택/사용/기록 처리
- [ ] 기본적인 쿼터 초과 예외 처리 (`CustomException` + `ERROR_CODES`)

---

## Phase 6 – Reference / Prompt + 태그 확장

### 1. 목표

- 북마크(레퍼런스)와 프롬프트를 태그와 함께 관리한다.
- 이후 AI 기능, 추천 기능과 자연스럽게 연결될 수 있는 기반을 만든다.

### 2. 포함 도메인

- `Reference`
- `Prompt`
- `TagRelation` (`REFERENCE` 타입은 이미 존재, `PROMPT` 타입 추가 필요)
- (기존 `Tag` 재사용)

**현재 상태**

- `TaggableType` enum에는 현재 `REFERENCE`와 `CHANNEL`만 있습니다.
- `PROMPT` 타입은 Phase 6에서 추가될 예정입니다.

### 3. 주요 기능

- Reference CRUD + 태그 관리
- Prompt CRUD + 태그 관리
- 태그 기반 검색/필터(간단 버전)
    - 예: “이 태그가 붙은 프롬프트/레퍼런스 목록”

### 4. 제외 범위

- 고급 검색(전문 검색, 하이라이트 등)
- 레퍼런스/프롬프트 추천/랭킹
- AI와의 실제 연동

### 5. 완료 체크리스트

- [x] Prisma: `references`, `prompts` 모델 확정 (이미 존재)
- [ ] Prisma: `TaggableType` enum에 `PROMPT` 추가 및 마이그레이션
- [ ] TagRelation에 `TaggableType.PROMPT` 적용
- [ ] Reference/Prompt 전용 엔드포인트 구현
- [ ] 태그 기반 필터/검색의 기본 쿼리 패턴 확립

---

## Phase 7 – AI Pipeline / Job / SSE

### 1. 목표

- 유튜브 영상에서 스크립트를 추출하고,
    - 분석 → 등장인물/설정 정의 → 이미지/대본 생성까지 이어지는  
      **AI 파이프라인**을 구축한다.
- 긴 작업을 Job으로 관리하고, SSE로 실시간 진행 상황을 스트리밍한다.

### 2. 포함 도메인

- `AiJob` 또는 `GenerationJob` (새 모델)
- SSE 전용 엔드포인트
- 외부 AI API 연동 (텍스트/이미지)

### 3. 주요 기능

- Job 생성
    - 입력: 유튜브 영상/스크립트/프롬프트/레퍼런스/태그 등
- Job 상태 관리
    - status: CREATED / RUNNING / FAILED / COMPLETED …
    - progress: 0~100, step 정보 등
- SSE
    - `GET /ai/jobs/:id/stream` (예시)
    - 클라이언트에 실시간 로그/진행률 전송
- 파이프라인 예시
    1. 유튜브 스크립트 추출
    2. 스크립트 분석 (챕터/등장인물/톤)
    3. 각 챕터별 대표 장면 + 이미지 생성
    4. 새 스크립트/콘텐츠로 재구성

### 4. 제외 범위

- 완벽한 편집/렌더링 툴 수준의 기능
- 복잡한 워크플로우 에디터
- 멀티 Job 의존성/스케줄링

### 5. 완료 체크리스트

- [ ] Job 모델/상태/에러 처리 구조 설계
- [ ] SSE 인프라 정리 (타임아웃/리트라이/권한 등)
- [ ] 최소 1개의 E2E 파이프라인(작은 버전) 동작
- [ ] 로깅/모니터링/에러 핸들링 점검

---

## 마무리

- **Phase 1 ~ 4**  
  → 데이터 수집 · 유저 구독 · 태그 · 인기 채널 조회까지의 **핵심 사용성**을 만든다.
- **Phase 5 ~ 6**  
  → 개인 API 키, 키워드 검색, 레퍼런스/프롬프트 관리로 **확장성**을 올린다.
- **Phase 7**  
  → AI 파이프라인과 SSE를 통해 **콘텐츠 생성/자동화 레벨**까지 끌어올린다.

각 Phase를 시작할 때마다:

1. 이 문서에서 해당 Phase 범위 확인
2. 포함 도메인 중 **하나의 기능 세트** 선택
3. `02-dev-process.md`의 6단계 루틴 적용

이 흐름으로 프로젝트 전체를 완성해 나간다.
