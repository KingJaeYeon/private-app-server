// ============================================
// 방법 1: Prisma Transaction + updateMany (권장)
// ============================================
async updateAllChannelsFromYouTube() {
this.logger.log('🔄 채널 데이터 갱신 스케줄러 시작');

try {
const today = new Date();
today.setHours(0, 0, 0, 0);

    const channels = await this.db.channel.findMany({
      where: { updatedAt: { lt: today } },
      select: {
        id: true,
        channelId: true,
        videoCount: true,
        lastVideoUploadedAt: true,
        viewCount: true,
        subscriberCount: true,
        handle: true
      }
    });

    if (channels.length === 0) {
      this.logger.log('✅ 갱신할 채널 없음');
      return;
    }

    this.logger.log(`📊 갱신 대상: ${channels.length}개 채널`);

    const serverKey = await this.apiKeyService.getServerApiKey();
    const { items: allItems } = await this.api.fetchChannelsBatch({
      apiKey: serverKey.apiKey,
      apiKeyId: serverKey.id,
      ids: channels.map((c) => c.channelId)
    });

    this.logger.log(`✅ API 응답: ${allItems.length}개 채널`);

    const now = new Date();
    const historyData: Omit<ChannelHistory, 'id' | 'createdAt'>[] = [];
    const channelMap = new Map(channels.map(({ channelId, ...others }) => [channelId, others]));

    // 업데이트할 채널 데이터 준비
    const updatePromises = [];

    for (const item of allItems) {
      const existingChannel = channelMap.get(item.id);
      if (!existingChannel) continue;

      const videoCount = parseInt(item.statistics.videoCount);
      const viewCount = BigInt(item.statistics.viewCount || 0);
      const subscriberCount = parseInt(item.statistics.subscriberCount);
      let lastVideoUploadedAt = existingChannel.lastVideoUploadedAt;

      // 비디오 개수 변경 시 마지막 업로드 시간 조회
      if (existingChannel.videoCount !== videoCount) {
        const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads!;
        const lastVideo = await this.api.fetchLastVideoUploadedAt({
          apiKey: serverKey.apiKey,
          apiKeyId: serverKey.id,
          upload: uploadPlaylistId
        });
        lastVideoUploadedAt = lastVideo.lastVideoUploadedAt;
      }

      // ✅ update Promise를 배열에 추가 (실행은 안함)
      updatePromises.push(
        this.db.channel.update({
          where: { channelId: item.id },
          data: {
            name: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
            videoCount,
            viewCount,
            subscriberCount,
            lastVideoUploadedAt,
            updatedAt: now
          }
        })
      );

      historyData.push({
        channelId: existingChannel.id,
        videoCount,
        viewCount,
        subscriberCount
      });
    }

    // ✅ Transaction으로 모든 업데이트를 한 번에 실행
    await this.db.$transaction([
      ...updatePromises,
      ...(historyData.length > 0 
        ? [this.db.channelHistory.createMany({ data: historyData })] 
        : []
      )
    ]);

    this.logger.log(`✅ 채널 ${updatePromises.length}개 업데이트 완료`);
    if (historyData.length > 0) {
      this.logger.log(`📊 히스토리 저장: ${historyData.length}개`);
    }

    this.logger.log('✅ 채널 데이터 갱신 완료');
} catch (error) {
this.logger.error(`❌ 채널 데이터 갱신 실패: ${error}`);
}
}

// ============================================
// 방법 2: Raw SQL (대량 데이터에 가장 빠름)
// ============================================
async updateAllChannelsFromYouTube() {
this.logger.log('🔄 채널 데이터 갱신 스케줄러 시작');

try {
const today = new Date();
today.setHours(0, 0, 0, 0);

    const channels = await this.db.channel.findMany({
      where: { updatedAt: { lt: today } },
      select: {
        id: true,
        channelId: true,
        videoCount: true,
        lastVideoUploadedAt: true,
        viewCount: true,
        subscriberCount: true,
        handle: true
      }
    });

    if (channels.length === 0) {
      this.logger.log('✅ 갱신할 채널 없음');
      return;
    }

    this.logger.log(`📊 갱신 대상: ${channels.length}개 채널`);

    const serverKey = await this.apiKeyService.getServerApiKey();
    const { items: allItems } = await this.api.fetchChannelsBatch({
      apiKey: serverKey.apiKey,
      apiKeyId: serverKey.id,
      ids: channels.map((c) => c.channelId)
    });

    this.logger.log(`✅ API 응답: ${allItems.length}개 채널`);

    const now = new Date();
    const historyData: Omit<ChannelHistory, 'id' | 'createdAt'>[] = [];
    const channelMap = new Map(channels.map(({ channelId, ...others }) => [channelId, others]));

    // 업데이트할 데이터 준비
    const updateData = [];

    for (const item of allItems) {
      const existingChannel = channelMap.get(item.id);
      if (!existingChannel) continue;

      const videoCount = parseInt(item.statistics.videoCount);
      const viewCount = BigInt(item.statistics.viewCount || 0);
      const subscriberCount = parseInt(item.statistics.subscriberCount);
      let lastVideoUploadedAt = existingChannel.lastVideoUploadedAt;

      if (existingChannel.videoCount !== videoCount) {
        const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads!;
        const lastVideo = await this.api.fetchLastVideoUploadedAt({
          apiKey: serverKey.apiKey,
          apiKeyId: serverKey.id,
          upload: uploadPlaylistId
        });
        lastVideoUploadedAt = lastVideo.lastVideoUploadedAt;
      }

      updateData.push({
        channelId: item.id,
        name: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.default?.url,
        videoCount,
        viewCount: viewCount.toString(), // BigInt를 문자열로
        subscriberCount,
        lastVideoUploadedAt,
        updatedAt: now
      });

      historyData.push({
        channelId: existingChannel.id,
        videoCount,
        viewCount,
        subscriberCount
      });
    }

    // ✅ Raw SQL로 CASE WHEN 사용한 대량 업데이트
    if (updateData.length > 0) {
      const channelIds = updateData.map(d => `'${d.channelId}'`).join(',');
      
      await this.db.$executeRaw`
        UPDATE "Channel"
        SET
          "name" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN '${d.name.replace(/'/g, "''")}'`
            ).join(' '))}
          END,
          "thumbnailUrl" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN ${d.thumbnailUrl ? `'${d.thumbnailUrl}'` : 'NULL'}`
            ).join(' '))}
          END,
          "videoCount" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN ${d.videoCount}`
            ).join(' '))}
          END,
          "viewCount" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN ${d.viewCount}`
            ).join(' '))}
          END,
          "subscriberCount" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN ${d.subscriberCount}`
            ).join(' '))}
          END,
          "lastVideoUploadedAt" = CASE "channelId"
            ${Prisma.raw(updateData.map(d => 
              `WHEN '${d.channelId}' THEN ${d.lastVideoUploadedAt ? `'${d.lastVideoUploadedAt.toISOString()}'` : 'NULL'}`
            ).join(' '))}
          END,
          "updatedAt" = ${now}
        WHERE "channelId" IN (${Prisma.raw(channelIds)})
      `;

      this.logger.log(`✅ 채널 ${updateData.length}개 업데이트 완료`);
    }

    if (historyData.length > 0) {
      await this.db.channelHistory.createMany({ data: historyData });
      this.logger.log(`📊 히스토리 저장: ${historyData.length}개`);
    }

    this.logger.log('✅ 채널 데이터 갱신 완료');
} catch (error) {
this.logger.error(`❌ 채널 데이터 갱신 실패: ${error}`);
}
}

// ============================================
// 방법 3: 병렬 처리 (Promise.all + 청크)
// ============================================
async updateAllChannelsFromYouTube() {
this.logger.log('🔄 채널 데이터 갱신 스케줄러 시작');

try {
const today = new Date();
today.setHours(0, 0, 0, 0);

    const channels = await this.db.channel.findMany({
      where: { updatedAt: { lt: today } },
      select: {
        id: true,
        channelId: true,
        videoCount: true,
        lastVideoUploadedAt: true,
        viewCount: true,
        subscriberCount: true,
        handle: true
      }
    });

    if (channels.length === 0) {
      this.logger.log('✅ 갱신할 채널 없음');
      return;
    }

    this.logger.log(`📊 갱신 대상: ${channels.length}개 채널`);

    const serverKey = await this.apiKeyService.getServerApiKey();
    const { items: allItems } = await this.api.fetchChannelsBatch({
      apiKey: serverKey.apiKey,
      apiKeyId: serverKey.id,
      ids: channels.map((c) => c.channelId)
    });

    this.logger.log(`✅ API 응답: ${allItems.length}개 채널`);

    const now = new Date();
    const historyData: Omit<ChannelHistory, 'id' | 'createdAt'>[] = [];
    const channelMap = new Map(channels.map(({ channelId, ...others }) => [channelId, others]));

    // ✅ 청크 단위로 병렬 처리 (DB 연결 제한 고려)
    const CHUNK_SIZE = 10; // 동시 처리 개수
    const chunks = [];
    
    for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
      chunks.push(allItems.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (item) => {
          const existingChannel = channelMap.get(item.id);
          if (!existingChannel) return;

          const videoCount = parseInt(item.statistics.videoCount);
          const viewCount = BigInt(item.statistics.viewCount || 0);
          const subscriberCount = parseInt(item.statistics.subscriberCount);
          let lastVideoUploadedAt = existingChannel.lastVideoUploadedAt;

          if (existingChannel.videoCount !== videoCount) {
            const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads!;
            const lastVideo = await this.api.fetchLastVideoUploadedAt({
              apiKey: serverKey.apiKey,
              apiKeyId: serverKey.id,
              upload: uploadPlaylistId
            });
            lastVideoUploadedAt = lastVideo.lastVideoUploadedAt;
          }

          await this.db.channel.update({
            where: { channelId: item.id },
            data: {
              name: item.snippet.title,
              thumbnailUrl: item.snippet.thumbnails?.default?.url,
              videoCount,
              viewCount,
              subscriberCount,
              lastVideoUploadedAt,
              updatedAt: now
            }
          });

          historyData.push({
            channelId: existingChannel.id,
            videoCount,
            viewCount,
            subscriberCount
          });
        })
      );
    }

    if (historyData.length > 0) {
      await this.db.channelHistory.createMany({ data: historyData });
      this.logger.log(`📊 히스토리 저장: ${historyData.length}개`);
    }

    this.logger.log('✅ 채널 데이터 갱신 완료');
} catch (error) {
this.logger.error(`❌ 채널 데이터 갱신 실패: ${error}`);
}
}

// ============================================
// 방법 4: Prisma의 createMany + upsert 패턴
// ============================================
async updateAllChannelsFromYouTube() {
this.logger.log('🔄 채널 데이터 갱신 스케줄러 시작');

try {
const today = new Date();
today.setHours(0, 0, 0, 0);

    const channels = await this.db.channel.findMany({
      where: { updatedAt: { lt: today } },
      select: {
        id: true,
        channelId: true,
        videoCount: true,
        lastVideoUploadedAt: true,
        viewCount: true,
        subscriberCount: true,
        handle: true
      }
    });

    if (channels.length === 0) {
      this.logger.log('✅ 갱신할 채널 없음');
      return;
    }

    this.logger.log(`📊 갱신 대상: ${channels.length}개 채널`);

    const serverKey = await this.apiKeyService.getServerApiKey();
    const { items: allItems } = await this.api.fetchChannelsBatch({
      apiKey: serverKey.apiKey,
      apiKeyId: serverKey.id,
      ids: channels.map((c) => c.channelId)
    });

    this.logger.log(`✅ API 응답: ${allItems.length}개 채널`);

    const now = new Date();
    const channelMap = new Map(channels.map(({ channelId, ...others }) => [channelId, others]));

    // ✅ 배치로 처리할 데이터 준비
    const operations = [];

    for (const item of allItems) {
      const existingChannel = channelMap.get(item.id);
      if (!existingChannel) continue;

      const videoCount = parseInt(item.statistics.videoCount);
      const viewCount = BigInt(item.statistics.viewCount || 0);
      const subscriberCount = parseInt(item.statistics.subscriberCount);
      let lastVideoUploadedAt = existingChannel.lastVideoUploadedAt;

      if (existingChannel.videoCount !== videoCount) {
        const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads!;
        const lastVideo = await this.api.fetchLastVideoUploadedAt({
          apiKey: serverKey.apiKey,
          apiKeyId: serverKey.id,
          upload: uploadPlaylistId
        });
        lastVideoUploadedAt = lastVideo.lastVideoUploadedAt;
      }

      operations.push({
        channelUpdate: this.db.channel.update({
          where: { channelId: item.id },
          data: {
            name: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
            videoCount,
            viewCount,
            subscriberCount,
            lastVideoUploadedAt,
            updatedAt: now
          }
        }),
        historyData: {
          channelId: existingChannel.id,
          videoCount,
          viewCount,
          subscriberCount
        }
      });
    }

    // ✅ 트랜잭션으로 모든 업데이트 + 히스토리 한 번에 처리
    await this.db.$transaction([
      ...operations.map(op => op.channelUpdate),
      this.db.channelHistory.createMany({
        data: operations.map(op => op.historyData)
      })
    ]);

    this.logger.log(`✅ 채널 ${operations.length}개 업데이트 완료`);
    this.logger.log(`📊 히스토리 저장: ${operations.length}개`);
    this.logger.log('✅ 채널 데이터 갱신 완료');
} catch (error) {
this.logger.error(`❌ 채널 데이터 갱신 실패: ${error}`);
}
}

// ============================================
// 성능 비교
// ============================================
/*
┌─────────────────────────────┬──────────────┬─────────────┬──────────────┐
│ 방법                         │ 100개 채널   │ 복잡도      │ 권장 상황    │
├─────────────────────────────┼──────────────┼─────────────┼──────────────┤
│ 1. Transaction (기본)        │ ~2-3초       │ 간단        │ < 1000개     │
│ 2. Raw SQL (CASE WHEN)      │ ~0.5-1초     │ 복잡        │ > 1000개     │
│ 3. Promise.all (청크)       │ ~1-2초       │ 중간        │ 중간 규모    │
│ 4. Transaction + createMany │ ~2-3초       │ 간단        │ 추천 ⭐      │
└─────────────────────────────┴──────────────┴─────────────┴──────────────┘

권장 순서:
1. 방법 1 또는 4 (가독성 좋고 안전)
2. 성능 문제 발생 시 → 방법 2 (Raw SQL)
3. DB 연결 제한 문제 → 방법 3 (청크 처리)
   */

🥇 방법 1 또는 4: Prisma Transaction (추천)
장점:

가독성이 좋고 안전
Prisma의 타입 안전성 유지
트랜잭션으로 원자성 보장
100~1000개 정도는 충분히 빠름

🥈 방법 2: Raw SQL (대량 데이터)

1000개 이상의 채널일 때만 고려
SQL의 CASE WHEN 사용해서 한 번에 업데이트
가장 빠르지만 복잡함

🥉 방법 3: 청크 병렬 처리

DB 연결 제한이 있을 때
10~20개씩 청크로 나눠서 병렬 처리

현재 규모라면 방법 1이나 4가 가장 적합합니다! 코드도 깔끔하고 성능도 충분합니다