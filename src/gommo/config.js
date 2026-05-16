const BASE_URL = 'https://v2.api.gommo.net';
const DEFAULT_DOMAIN = '79ai.net';
const DEFAULT_PROJECT_ID = 'default';

const JOB_TYPES = ['image', 'video', 'tts', 'music', 'avatar-lipsync'];
const POLL_MEDIA = { image: 'image', video: 'video', music: 'music', 'avatar-lipsync': 'video' };

module.exports = {
  BASE_URL,
  DEFAULT_DOMAIN,
  DEFAULT_PROJECT_ID,
  JOB_TYPES,
  POLL_MEDIA,
};
