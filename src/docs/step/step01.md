0. 전체 흐름 한 줄로 먼저 박자

MVP에서 할 일은 결국 이거야:

백엔드
Phase 1~4 도메인(채널/히스토리/구독/태그/인기 조회)을
도메인별 6단계 프로세스로 하나씩 구현하고,

프론트
각 Phase가 끝날 때마다
“그 Phase의 핵심 기능을 눈으로 확인할 수 있는 최소 화면”을 같이 만든다.

그래서 “MVP + 프론트 타이밍”은 이렇게 맞추자:
1.	Phase 1 끝 → Public 채널 리스트/상세 화면 (비로그인용)
2.	Phase 2 끝 → 내 구독 채널 화면
3.	Phase 3 끝 → 태그 관리 UI
4.	Phase 4 끝 → 인기 구독 채널(성장 기반) 화면

이제 Phase별로 쪼개서 보자.

⸻

Phase 0 – 인프라 / 공통 규칙 정리 (이미 거의 끝난 구간)

목적
도메인 구현 들어가기 전에, 앞으로 계속 쓸 “전역 룰”을 고정해두는 구간.

0.1 체크리스트
-	Nest 공통
-	Global Exception Filter + CustomException, ERROR_CODES
-	ResponseInterceptor (성공 응답 { success, data?, timestamp })
-	@Public(), @CurrentUser() 잘 동작하는지
-	Prisma
-	User, Channel, ChannelHistory, Subscription, Tag, TagRelation, ApiKey 기본 모델 정의
-	규칙
-	GET → ResponseDto 반환
-	non-GET → { id?, count?, message } 반환
-	실패는 전부 예외 던지고 필터에서 처리

여기는 이미 대부분 되어 있으니까, **“문서에 룰만 박아두는 단계”**라고 보면 된다.

프론트: 아직 안 만든다 (이 단계에서 만들 필요 없음)

⸻

Phase 1 – Channel + ChannelHistory + Public API

MVP 도메인 대응
- 1.3 Channel
- 1.4 ChannelHistory
- Public API

목표
로그인 없이도:
- 최근 추가된 채널 10개 리스트
- 각 채널의 상세 정보(필요하면 간단 히스토리)

를 볼 수 있게 만드는 것.

1.1 백엔드 작업
- Prisma 모델 최종 확정
  - Channel
  - ChannelHistory
  - ApiKey (type = SERVER 인 애들)
- Public 모듈
  - PublicModule
  - PublicController
  - PublicService
- 엔드포인트
  - GET /public/channels
  - 최근 생성 순 10개
  - GET /public/channels/:channelId
  - Channel 하나 조회
  - “최근 추가된 10개 안에 없으면 FORBIDDEN” 같은 비즈니스 규칙 적용
- ChannelHistory 스케줄러 (1차 버전)
  - 하루 1회 @Cron 으로 돌려서
  - 모든 Channel에 대해 YouTube API 호출 → channel_histories 에 insert
  - 처음엔 성능/쿼터 고민 없이 “일단 돈다” 수준이면 충분

1.2 프론트는 언제?

Phase 1 끝나자마자 바로 프론트 2페이지 만든다.
- Public 채널 리스트 페이지
  - /public/channels 호출
  - 카드/테이블 형태로 10개 채널 보여주기
  - 썸네일, 제목, 구독자 수 정도만 보여줘도 됨
- Public 채널 상세 페이지
  - /public/channels/:id
  -   채널 메타 정보 + (있으면) 최근 히스토리 간단 표시

이 두 화면이 서비스 첫 인상 + 백엔드 정상 작동 여부 체크용이라
Phase 1 끝나고 꼭 한 번 붙이는 걸 추천.

⸻

Phase 2 – User/Auth + Subscription

MVP 도메인 대응
- 1.1 Auth / User
- 1.5 Subscription

목표
로그인 유저가:
- 채널을 “내 구독 목록”에 넣고,
- 다시 리스트로 볼 수 있는 상태.

2.1 백엔드 작업
1.	User/Auth 안정화
•	이미 기본은 되어 있으니까:
•	@CurrentUser() 로 user.id 잘 나오는지만 확실히
2.	Subscription 모델
•	user_id, channel_id, created_at, updated_at
•	@@unique([user_id, channel_id])
3.	엔드포인트 세트
•	POST /channels/subscriptions
•	body: { channelId: number }
•	응답: { id: number, message: string }
•	GET /channels/subscriptions
•	내 구독 목록 + Channel join
•	응답: SubscriptionResponseDto[]
•	DELETE /channels/subscriptions/:id
•	응답: { id: number, message: string }
•	DELETE /channels/subscriptions
•	body: { ids: number[] }
•	응답: { count: number, message: string }

2.2 프론트는 언제?

Phase 2 끝나고 나면 다음 화면 추가.
1.	내 구독 채널 리스트 페이지
•	로그인 전제 (Clerk/토큰 기반)
•	GET /channels/subscriptions 호출
•	Public 리스트랑 거의 동일한 UI에
•	“구독 해제” 버튼
•	(나중에 태그/필터 자리만 비워둬도 됨)
2.	구독 버튼
•	Public 채널 상세 페이지에
•	“로그인 유저면 → 구독하기 / 구독 해제 버튼” 노출
•	POST /channels/subscriptions, DELETE ... 붙이기

여기까지 오면,
“방문자 → 로그인 유저 → 내 구독 관리” 흐름이 눈으로 보이기 시작한다.

⸻

Phase 3 – Tag + TagRelation (채널 기준)

MVP 도메인 대응
•	1.6 Tag
•	1.7 TagRelation (channel)

목표
“내 구독 채널을 태그로 정리”할 수 있는 상태.

3.1 백엔드 작업
1.	Tag / TagRelation 모델 정리
•	Tag: id, name, slug, usage_count …
•	TagRelation:
•	tag_id, user_id, taggable_type, taggable_id, created_at
•	MVP: taggable_type = 'CHANNEL' 만 허용
2.	엔드포인트 세트 (채널 기준)
•	POST /channels/:channelId/tags
•	body: { names: string[] } or { tagIds: number[] }
•	없는 이름이면 Tag 새로 만들고 usage_count++
•	TagRelation insert
•	응답: { count: number, message: string }
•	GET /channels/:channelId/tags
•	응답: ChannelTagDto[]
•	DELETE /channels/:channelId/tags
•	body: { tagIds: number[] }
•	응답: { count: number, message: string }

3.2 프론트는 언제?

Phase 3 끝나고 “내 구독 채널 페이지”를 확장한다.
1.	태그 뱃지 + 태그 편집 UI
•	내 구독 리스트 각 채널 카드에:
•	붙어 있는 태그 뱃지들 표시
•	“태그 관리” 버튼/아이콘을 하나 둬서:
•	태그 추가 (새 이름 입력 → POST)
•	태그 삭제 (체크/토글 → DELETE)
2.	간단 태그 필터
•	상단에 “태그 선택” 영역 두고
•	특정 태그 선택 시 프론트에서 필터하거나,
•	나중 Phase 4에서 백엔드 쿼리로 연결할 준비만 해둬도 됨

이 시점에서 구독 채널을
“그냥 리스트”가 아니라 “내가 붙여둔 분류(label) 기반으로 관리”하는 느낌이 생긴다.

⸻

Phase 4 – 내 구독 채널 + 성장 데이터 기반 조회(간단 버전)

MVP 도메인 대응
•	1.8 “인기 채널 조회” (조합 로직)

목표
내 구독 채널 + 태그 + 히스토리를 조합해서
“요즘 잘 크는 채널” 리스트 한 번에 뽑는 API + 화면 만들기.

4.1 백엔드 작업
1.	사용하는 도메인
•	Subscription – 내 채널 범위
•	Channel – 메타 정보
•	ChannelHistory – 성장 데이터
•	TagRelation – 태그 필터
2.	엔드포인트 설계 (예시)
•	GET /me/popular-channels
•	query:
•	tagIds?: number[]
•	days?: number (기본 7 or 30)
•	take?: number (기본 10~20)
•	내부 로직 (1차 버전):
1.	내 subscription → channelId 배열
2.	tagIds 있으면 TagRelation으로 channelId 필터링
3.	ChannelHistory에서 각 channelId에 대해
•	최근 N일 viewCount 증가량 계산
4.	growth 기준으로 정렬 후 상위 N개
•	응답: PopularChannelDto[]
(기본은 ChannelResponseDto + growth 필드 하나 추가 정도)

4.2 프론트는 언제?

Phase 4 끝나고 “MVP 메인 화면”을 만든다.
1.	인기 구독 채널 화면
•	상단:
•	기간 선택 (7일 / 30일)
•	태그 필터 (멀티 셀렉트)
•	본문:
•	성장률/증가량 높은 순으로 채널 카드 리스트
•	각 카드에:
•	채널 정보
•	“+XX% / +YY만 회” 같은 성장 지표
2.	이 화면은 전체 서비스의 “핵심 가치 화면”이 된다.

여기까지 되면,
“그냥 채널 모아서 보는 서비스”가 아니라
**“내 구독 중에서 요즘 치고 올라오는 채널을 골라볼 수 있는 도구”**가 된다.

⸻

정리: MVP + 프론트 타이밍 다시 한 번 요약
•	Phase 1 (Channel / ChannelHistory / Public)
→ 백엔드 완료 후
→ Public 채널 리스트/상세 화면 바로 제작
•	Phase 2 (Auth / Subscription)
→ 백엔드 완료 후
→ 내 구독 채널 리스트 + 구독/해제 버튼 추가
•	Phase 3 (Tag / TagRelation)
→ 백엔드 완료 후
→ 구독 채널 태그 관리 UI + 간단 태그 필터 추가
•	Phase 4 (인기 채널 조회)
→ 백엔드 완료 후
→ 인기 구독 채널 메인 화면 제작

그 뒤부터는:
•	KeywordSearch, UserApiKey, Reference/Prompt, AI/SSE 같은 건
MVP 이후 Phase 5+ 로 밀고 천천히 붙이면 된다.