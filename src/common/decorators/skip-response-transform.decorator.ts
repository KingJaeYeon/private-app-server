import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_TRANSFORM = 'skip_response_transform';

/**
 * @example 사용예시
 * SkipResponseTransform()
 * Get('download')
 * downloadFile(@Res() res: Response) { // 파일 다운로드
 *   return res.download('file.pdf');
 * }
 *
 * SkipResponseTransform()
 * Get('proxy')
 * async proxy() { // 외부 API 프록시 (raw 응답 그대로)
 *   return fetch('https://api.example.com/data')
 *     .then(r => r.json());
 * }
 *
 * SkipResponseTransform()
 * Get('legacy')
 * getLegacy() { // 레거시 API (다른 응답 포맷)
 *   return { code: 200, result: {...} }; // 기존 포맷 유지
 * }
 */
export const SkipResponseTransform = () => SetMetadata(SKIP_RESPONSE_TRANSFORM, true);
