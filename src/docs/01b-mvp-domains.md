# MVP Domain List

> 목적:  
> 전체 서비스 중에서 **1차 목표(MVP)** 에 필요한 도메인만 추려서  
> “지금 당장 신경 쓸 세계관”을 명확히 한다.

MVP 범위는 다음 네 축을 중심으로 한다.

1. **Channel + ChannelHistory + Public API**
2. **User/Auth + Subscription**
3. **Tag + TagRelation (우선 채널에만 적용)**
4. **내 구독 채널 + 성장 데이터 기반 조회(간단 버전)**

이 범위를 구현하면:

- 유저 없이도 **채널 데이터가 쌓이고, 히스토리가 기록**되고,
- 로그인 유저는 **채널을 구독하고, 태그로 관리하고, 성장 추이를 기반으로 채널을 탐색**할 수 있다.

---

## 1. MVP에 포함되는 도메인

### 1.1 Auth / User

**역할**

- 사용자 계정/로그인/로그아웃/토큰 관리를 담당한다.
- 각 도메인(구독, 태그, “내 채널 조회” 등)에 접근 권한을 부여한다.

**핵심 책임**

- 이메일/비밀번호 또는 기타 방식으로 **사용자 인증**
- Access Token / Refresh Token 발급 및 검증
- `@CurrentUser()`로 사용할 수 있는 **JWT Payload 구조 제공**

**MVP에서의 범위**

- 기본 회원가입/로그인/로그아웃
- 인증된 요청에서 `user.id`를 안정적으로 가져오는 것
- 소셜 로그인, 비밀번호 재설정, 2FA 등은 **MVP 범위 밖**

---

### 1.2 AdminApiKey (서버 관리용 YouTube API Key)

**역할**

- 서버에서 채널 및 히스토리 데이터를 수집할 때 사용하는 **관리자 전용 유튜브 API 키**를 저장한다.

**핵심 책임**

- 유효한 관리자 API Key 목록 관리
- 스케줄러/백그라운드 작업에서 이 키를 사용해 YouTube API 요청

**MVP에서의 범위**

- 최소 1개 이상의 유효한 API Key를 관리
- 간단한 우선순위/라운드로빈 정도로 키를 선택해 사용해도 충분함
- 키 할당량/로테이션 최적화는 후순위

---

### 1.3 Channel

**역할**

- 유튜브 채널의 **기본 메타데이터**를 저장하고 관리하는 핵심 도메인.

**핵심 책임**

- handle 또는 채널 URL 기반으로 채널 등록
- 관리자 API Key를 통해 유튜브 API에서 메타데이터 조회
- 채널 정보(제목, 설명, 썸네일 등)를 저장/갱신
- 사용자가 원하는 채널을 직접 등록할 수 있는 진입점

**MVP에서 필요한 기능**

- 서버/관리자에 의한 채널 등록 (초기 시드/운영용)
- 사용자의 요청에 의한 채널 등록 (원할 경우)
- 채널 목록/상세 조회 (Public, Private 양쪽에서 재사용)

---

### 1.4 ChannelHistory

**역할**

- 각 채널의 **시간에 따른 지표(viewCount 등)** 를 누적 기록하는 도메인.

**핵심 책임**

- 스케줄러(하루 1회 등)에 의해:
    - 모든 채널(또는 활성 채널)에 대해 YouTube API 호출
    - 조회수 등의 지표를 `channel_history`에 기록
- 간단한 통계를 뽑을 수 있는 최소한의 구조 제공:
    - 최근 N일 데이터
    - 특정 기간 동안의 증가량/성장률

**MVP에서 필요한 기능**

- Channel과의 관계 설정 (`channel_id`)
- 하루 1회 이상 히스토리 기록 배치
- 채널 상세 조회 시:
    - 최근 일정 개수의 기록(예: 최근 7일/30일)을 함께 내려줄 수 있는 정도

---

### 1.5 Subscription

**역할**

- **“어떤 사용자가 어떤 채널을 구독하고 있는지”** 저장하는 도메인.

**핵심 책임**

- `user_id + channel_id` 조합 유니크 제약
- 내 구독 목록 기준으로:
    - 채널 리스트
    - 성장 데이터, 태그 필터 등을 조합한 조회의 기반 제공

**MVP에서 필요한 기능**

- `POST /channels/subscriptions`
    - 로그인한 유저가 채널을 구독
- `GET /channels/subscriptions`
    - 내가 구독한 채널 목록을 조회
    - 채널 메타데이터와 조인
- `DELETE /channels/subscriptions` (bulk 삭제)
- 구독 삭제 시 일관성 유지
    - (채널 삭제 시 구독 삭제는 MVP에서는 단순한 처리로도 충분)

**구현 참고**

- Subscription은 Channels 모듈 내부에 `SubscriptionService`와 `SubscriptionsController`로 구현되어 있습니다.
- 엔드포인트는 `/channels/subscriptions` 경로를 사용합니다.
- Subscription에도 태그를 부착할 수 있으며, `taggable_type = CHANNEL`을 사용합니다.

---

### 1.6 Tag

**역할**

- 태그 이름/슬러그/사용 횟수(usage_count)를 관리하는 공통 도메인.

**핵심 책임**

- 새 태그를 생성하고, 이름/슬러그 중복을 제어
- 태그 사용 횟수를 누적해 추천에 활용할 기반 마련

**MVP에서의 범위**

- 태그 엔티티 자체 구현(name/slug/usage_count 등)
- 채널에만 우선 적용 (프롬프트/레퍼런스는 후순위)
- 태그 생성/조회 정도의 단순 API

---

### 1.7 TagRelation (채널 기준 우선)

**역할**

- 태그와 실제 대상(채널, 프롬프트, 레퍼런스 등)을 연결하는 **폴리모픽 관계 테이블**.

**핵심 책임**

- `tag_id`, `taggable_type`, `taggable_id` 조합 관리
- 한 채널에 여러 태그, 한 태그가 여러 채널에 붙을 수 있는 구조
- 태그 기반 필터/검색을 위한 효율적인 쿼리 패턴 제공

**MVP에서의 범위**

- `taggable_type = 'channel'` 만 우선 지원
- 다음 기능 세트:
    - 채널에 태그 추가
        - 태그가 없으면 Tag를 새로 만들고 usage_count 증가
        - TagRelation에 연결 추가
    - 채널에 달린 태그 목록 조회
    - 채널에서 태그 제거

---

### 1.8 “인기 채널 조회” (별도 모델 없이, 조합 로직으로 처리)

**역할**

- 유저가 구독한 채널들 중에서
    - 태그 기준으로 필터링하고,
    - `channel_history` 데이터로 정렬/랭킹해서
    - “요즘 잘 나가는 채널” 같은 리스트를 만든다.

**핵심 책임**

- 별도 테이블 없이도:
    - subscription + channel + channel_history + tag_relation 조인을 통해
    - “내 구독 채널 + 성장 데이터 + 태그 필터” 조합 결과를 만드는 로직 구현
- 이후 필요하다면 별도 Recommendation/Popular 테이블로 분리 가능

**MVP에서의 범위**

- `GET /me/popular-channels` (또는 유사한 엔드포인트)에서:
    - 내 구독 채널들만 대상
    - 기본 정렬: 최근 N일 성장량 or 최근 값 기준
    - 옵션:
        - 특정 태그들만 포함하는 필터
- 고급 추천/캐싱/랭킹 알고리즘은 **MVP 범위 밖**  
  (단순 정렬/필터 수준으로도 충분히 가치 있음)

---

## 2. MVP에서 제외되는 도메인 (후순위)

아래 도메인들은 전체 서비스에서는 중요하지만, **MVP 구현 단계에서는 제외**한다.

### 2.1 UserApiKey

- 유저가 직접 등록하는 유튜브/AI API 키
- 키를 통한 개인별 쿼터 분리
- **상태:** Phase 5 이후에 설계 및 구현

### 2.2 ApiUsage / Quota

- 일일/월간 사용량 기록
- 키/유저별 쿼터 제한/초과 처리
- **상태:** 키워드 검색/개인 API 사용이 들어갈 때 함께 도입

### 2.3 KeywordSearch / SearchJob

- 키워드 기반 유튜브 검색
- 유저별 API 키를 사용해 쿼터를 소모
- 비동기 Job/캐싱이 필요할 수 있음
- **상태:** MVP 이후, Phase 5에서 고려

### 2.4 Reference / Prompt

- 레퍼런스(북마크), 프롬프트 AI 템플릿 저장
- 태그를 활용한 관리/추천
- **상태:** Phase 6 이후 확장

### 2.5 Recommendation / PopularChannel (별도 테이블)

- 인기 채널/추천 결과를 별도의 테이블로 물리적으로 저장/캐싱
- 배치/실시간 계산 최적화
- **상태:** MVP에서는 “조인 + 정렬” 로직으로 충분, 추후 필요하면 도입

### 2.6 AIJob / GenerationJob + SSE 파이프라인

- 유튜브 스크립트 추출/분석/생성형 파이프라인
- 긴 Job 상태 관리 및 SSE 스트리밍
- **상태:** Phase 7 (가장 후순위)

---

## 3. 요약

MVP 단계에서 집중할 도메인은 다음과 같다.

- **필수**
    - Auth / User
    - AdminApiKey
    - Channel
    - ChannelHistory
    - Subscription
    - Tag
    - TagRelation (채널 기준)
- **조합 로직 (별도 테이블 없이)**
    - “내 구독 채널 인기 조회” (Subscription + ChannelHistory + Tag 기반)

반대로, 아래 도메인들은 “지금 당장 고민하지 않아도 되는 것들”로 분류한다.

- UserApiKey, ApiUsage / Quota
- KeywordSearch / SearchJob
- Reference, Prompt
- 별도 Recommendation 테이블
- AIJob / GenerationJob, SSE 파이프라인

이 문서를 기준으로:

- **Prisma 모델 설계 우선순위**
- **NestJS 모듈/도메인 생성 순서**
- **Phase 1~4 작업 계획**

을 구체화하면 된다.
