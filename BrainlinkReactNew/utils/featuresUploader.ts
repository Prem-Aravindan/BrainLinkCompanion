import AsyncStorage from '@react-native-async-storage/async-storage';
// NetInfo may be unavailable until native rebuild; make it optional.
let NetInfo: any = undefined as any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-community/netinfo');
  NetInfo = mod?.default ?? mod;
} catch {}
import { FeatureRecord } from './features';

export type FeatureUploaderConfig = {
  endpoint: string;
  sessionId: string;
  authToken?: string;
  sampleRate: number;
  maxBatchSize?: number; // default 20
  maxIntervalMs?: number; // default 10000
  queueCap?: number; // default 5000
  debug?: boolean;
};

const STORAGE_KEY = 'eeg_feature_queue_v1';
const DEBUG_EEG = false;

export class FeatureUploader {
  private endpoint: string;
  private sessionId: string;
  private authToken?: string;
  private maxBatchSize: number;
  private maxIntervalMs: number;
  private queueCap: number;
  private debug: boolean;

  private queue: FeatureRecord[] = [];
  private timer: any = null;
  private lastFlush = 0;
  private backoffMs = 4000;
  private online = true;
  private initialized = false;

  constructor(cfg: FeatureUploaderConfig) {
    this.endpoint = cfg.endpoint;
    this.sessionId = cfg.sessionId;
    this.authToken = cfg.authToken;
    this.maxBatchSize = cfg.maxBatchSize ?? 20;
    this.maxIntervalMs = cfg.maxIntervalMs ?? 10000;
    this.queueCap = cfg.queueCap ?? 5000;
    this.debug = !!cfg.debug;
    this.init();
  }

  private async init() {
    if (this.initialized) return;
    // restore
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.queue = JSON.parse(raw);
    } catch {}
    // netinfo
    if (NetInfo?.addEventListener) {
      NetInfo.addEventListener((state: any) => {
        const nowOnline = !!state?.isConnected && !!state?.isInternetReachable;
        this.online = !!nowOnline;
        if (this.debug || DEBUG_EEG) console.log('[Uploader] Net change online=', this.online);
        if (this.online) this.scheduleFlush(0);
      });
    } else {
      // Fallback: optimistic online; allow flush attempts which will backoff on failure
      if (this.debug || DEBUG_EEG) console.log('[Uploader] NetInfo unavailable; proceeding without offline detection');
      this.online = true;
    }
    this.initialized = true;
    this.scheduleFlush(this.maxIntervalMs);
  }

  async enqueue(rec: FeatureRecord) {
    // cap queue
    if (this.queue.length >= this.queueCap) this.queue.shift();
    this.queue.push(rec);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    if (this.debug || DEBUG_EEG) console.log(`[Uploader] Enqueued. size=${this.queue.length}`);
    if (this.queue.length >= this.maxBatchSize) this.scheduleFlush(0);
  }

  private scheduleFlush(delay: number) {
    const now = Date.now();
    const since = now - this.lastFlush;
    const due = Math.max(0, delay ?? Math.max(0, this.maxIntervalMs - since));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), due);
  }

  private computeBackoff(): number {
    const jitter = Math.random() * 500;
    const next = Math.min(60000, this.backoffMs * 2);
    this.backoffMs = next;
    return this.backoffMs + jitter;
  }

  private resetBackoff() {
    this.backoffMs = 4000;
  }

  async flush() {
    this.lastFlush = Date.now();
    if (!this.online) { this.scheduleFlush(this.maxIntervalMs); return; }
    if (this.queue.length === 0) { this.scheduleFlush(this.maxIntervalMs); return; }

    const batch = this.queue.slice(0, this.maxBatchSize);
    const body = {
      session_id: this.sessionId,
      sample_rate: batch[0]?.fs ?? 0,
      t0: batch[0]?.t0 ?? 0,
      t1: batch[batch.length - 1]?.t1 ?? 0,
      count: batch.length,
      features: batch,
    };

    const headers: any = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    try {
      if (this.debug || DEBUG_EEG) console.log(`[Uploader] POST → ${this.endpoint} count=${batch.length}`);
      const res = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // success: drop batch
      this.queue.splice(0, batch.length);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      if (this.debug || DEBUG_EEG) console.log(`[Uploader] POST OK. remaining=${this.queue.length}`);
      this.resetBackoff();
      // immediate next flush if more pending
      if (this.queue.length >= this.maxBatchSize) this.scheduleFlush(0); else this.scheduleFlush(this.maxIntervalMs);
    } catch (e) {
      if (this.debug || DEBUG_EEG) console.log('[Uploader] POST failed:', e);
      const delay = this.computeBackoff();
      this.scheduleFlush(delay);
    }
  }
}
