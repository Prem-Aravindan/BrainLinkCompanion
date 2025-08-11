export const featureConfig = {
  enabled: true,
  endpoint: 'https://example.com/eeg/features', // TODO: replace with real endpoint
  sessionId: 'dev-session-001', // TODO: set per session
  authToken: undefined as string | undefined,
  maxBatchSize: 20,
  maxIntervalMs: 10000,
  queueCap: 5000,
  DEBUG_EEG: false,
};
