# 1-1. 각 도메인 문서 공통 템플릿

## Domain Spec – Channels

### 1. 도메인 목적
- 이 도메인은 무엇을 위해 존재하는가?
- 예: "유튜브 채널 메타데이터를 저장/조회하고, 히스토리/구독/태그에 연결되는 중심 도메인"

### 2. 주요 시나리오 (User Flow 기준)
1) 사용자가 채널 URL/handle로 채널을 등록한다.
2) 등록된 채널 목록을 조회한다.
3) 채널 상세에서 메타/히스토리/태그를 본다.
4) 더 이상 필요 없는 채널을 삭제한다.
5) (옵션) 특정 조건으로 필터/검색한다.

### 3. 관련 엔티티 & 관계 (Prisma 기준)
- Channel
    - 필드 요약 (schema.prisma에서 가져오기)
- ChannelHistory (연관만 간단히)
- Subscription (채널 기준으로 어떻게 연결되는지)
- TagRelation (채널과 태그 연결 방식)

### 4. 엔드포인트 목록 (이 도메인이 책임지는 API만)
- REST 목록 (이미 02에 일부 있음 → 이 도메인 관점에서 다시 정리)
- 각 엔드포인트에:
    - 목적
    - 입력 (Param/Query/Body 요약)
    - 주요 비즈니스 규칙 (중복, 권한 등)

### 5. 비즈니스 규칙 정리
- 중복 등록 방지 규칙
- 삭제 시 제약 (히스토리/구독/태그 처리 방식)
- Public vs Private 접근 권한

### 6. TODO / 나중 확장
- MVP에서 제외한 기능들 메모
- 예: "채널 검색어 추천은 Phase 3에서 처리"

---

# 2. 코드 쪽 가이드라인: “문서 → 실제 Nest 모듈” 연결 순서

## 2-1. 도메인 하나 선택해서 “파일 세팅”부터

### 1.	src/modules/channels/ 밑에 구조를 고정:

```
src/modules/channels/
├── channels.module.ts
├── channels.controller.ts
├── channels.service.ts
├── channels.helper.service.ts   // 필요하면
└── dto/
├── create-channel.dto.ts
├── update-channel.dto.ts
├── channel-response.dto.ts
└── channel-list.dto.ts
```

### 2.	channels.service.ts 상단에 유즈케이스 TODO부터 박기

```ts
/**
 * [Domain] Channels
 * - 유저별 YouTube 채널 관리
 */

// TODO: createChannel(userId, dto)
// TODO: getChannels(userId, dto)
// TODO: getChannelDetail(userId, channelId)
// TODO: updateChannel(userId, channelId, dto)
// TODO: deleteChannel(userId, channelId)

@Injectable()
export class ChannelsService {
  constructor(
    private readonly db: PrismaService,
    // private readonly youtubeHelperService: YoutubeHelperService,
  ) {}
}
```

### 3.	각 함수 안에서도 단계별 TODO

```ts
async createChannel(userId: string, dto: CreateChannelDto): Promise<ChannelResponseDto> {
  // TODO: dto.handle / url 파싱해서 channelId 추출 (helper로 위임)
  // TODO: 채널이 이미 존재하는지 확인 (channel.channel_id)
  // TODO: 존재하지 않으면 YouTube API로 메타데이터 조회
  // TODO: Prisma channel create
  // TODO: ChannelResponseDto로 매핑해서 반환
}
```
