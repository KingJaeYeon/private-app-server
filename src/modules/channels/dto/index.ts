export * from './subscribe-channel.dto';
export * from './update-subscription.dto';
export * from './channel-history-response.dto';

export enum ChannelSortEnum {
  VIEW_COUNT = 'viewCount',
  SUBSCRIBER_COUNT = 'subscriberCount',
  CREATED_AT = 'createdAt'
}

export enum ChannelOrderEnum {
  ASC = 'asc',
  DESC = 'desc'
}

export enum UploadPeriodEnum {
  ALL = 'all',
  D7 = '7d',
  D14 = '14d',
  M1 = '1m',
  M2 = '2m',
  M3 = '3m',
  M6 = '6m',
  Y1 = '1y'
}

export enum SubscriberStatusEnum {
  SUB_10K_UNDER = '10K_under',
  SUB_10K_100K = '10K_100K',
  SUB_100K_500K = '100K_500K',
  SUB_500K_1M = '500K_1M',
  SUB_1M_OVER = '1M_over'
}

export enum ViewCountEnum {
  VIEW_100K_UNDER = '100K_under',
  VIEW_100K_1M = '100K_1M',
  VIEW_1M_OVER = '1M_over'
}
