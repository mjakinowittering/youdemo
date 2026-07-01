import type { VideoEncodingQuality } from '../types/quality';

export const VIDEO_BPS_OPTIONS: Record<VideoEncodingQuality, number> = {
    low: 2_000_000,
    medium: 5_000_000,
    high: 8_000_000,
};

export const AUDIO_BPS_OPTIONS: Record<VideoEncodingQuality, number> = {
    low: 64_000,
    medium: 96_000,
    high: 128_000,
};
