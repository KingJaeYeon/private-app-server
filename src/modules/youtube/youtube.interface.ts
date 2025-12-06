export interface IYouTubeChannelData {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    description?: string;
    publishedAt: string;
    thumbnails?: {
      default?: { url: string };
    };
    country?: string;
    defaultLanguage?: string;
  };
  statistics: {
    videoCount: string;
    viewCount: string;
    subscriberCount: string;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  lastVideoUploadedAt?: Date | null;
}

export interface IYouTubeVideoData {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description?: string;
    channelTitle?: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails?: {
      default?: { url: string };
      maxres?: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export interface IVideoSearchFilter {
  minViews: number;
  minViewsPerHour: number;
  videoDuration: 'short' | 'medium' | 'long' | 'all';
  days: number;
  maxChannels: number;
  isPopularVideosOnly: boolean;
}

export interface IVideoSearchResult {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  viewsPerHour: number;
  viewsPerSubscriber: number | null;
  duration: string;
  durationSeconds: number;
  link: string;
  thumbnailUrl: string;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  channel: {
    handle: string | null;
    subscriberCount: number;
    videoCount: number;
    viewCount: string;
    regionCode: string | null;
    link: string;
    publishedAt: Date;
    thumbnailUrl: string | null;
  };
}

export interface IKeywordSearchFilter {
  keyword: string;
  days: number;
  maxResults: number;
  regionCode?: string;
  relevanceLanguage?: string;
  videoDuration: 'any' | 'short' | 'medium' | 'long';
  minViews: number;
  minViewsPerHour: number;
}

export interface IKeywordSearchResult {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  viewsPerHour: number;
  viewsPerSubscriber: number | null;
  duration: string;
  durationSeconds: number;
  link: string;
  thumbnailUrl: string;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  channel: {
    handle: string | null;
    subscriberCount: number;
    videoCount: number;
    viewCount: string;
    regionCode: string | null;
    link: string;
    publishedAt: Date;
    thumbnailUrl: string | null;
  };
}

