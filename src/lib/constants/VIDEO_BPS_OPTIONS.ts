import type { VideoEncodingQuality } from '../types/quality';

export const VIDEO_BPS_OPTIONS: Record<VideoEncodingQuality, number> = {
    low: 2000000,
    medium: 5000000,
    high: 8000000,
};

export const AUDIO_BPS_OPTIONS: Record<VideoEncodingQuality, number> = {
  low: 64_000,
  medium: 96_000,
  high: 128_000,
};
