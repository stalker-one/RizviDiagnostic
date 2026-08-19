export const LIVE_APP_URL = 'https://stalker-one-rizvidiagnostic.vercel.app';

export function getLiveAppUrl(path = '') {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return normalizedPath ? `${LIVE_APP_URL}/${normalizedPath}` : LIVE_APP_URL;
}
