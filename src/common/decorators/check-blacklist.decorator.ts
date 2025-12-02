import { SetMetadata } from '@nestjs/common';

export const CHECK_BLACKLIST_KEY = 'check_blacklist';

/**
 * 블랙리스트 체크를 활성화하는 데코레이터
 * @example
 * CheckBlacklist()
 * Post('send-email')
 * sendEmail() {}
 */
export const CheckBlacklist = () => SetMetadata(CHECK_BLACKLIST_KEY, true);
