import { Request } from 'express';

/**
 * Request에서 실제 IP 주소를 추출하는 유틸리티
 * 프록시/로드밸런서 환경을 고려하여 x-forwarded-for, x-real-ip 헤더를 확인
 */
export class RequestUtil {
  static extractIp(request: Request): string {
    // x-forwarded-for 헤더 (프록시/로드밸런서 뒤에 있을 때)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }

    // x-real-ip 헤더 (일부 프록시 사용)
    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    // Express의 trust proxy 설정으로 설정된 IP
    if (request.ip) {
      return request.ip;
    }

    // 직접 연결
    return request.socket.remoteAddress || 'unknown';
  }
}

