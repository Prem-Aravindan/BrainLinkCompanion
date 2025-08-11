// EEG Feature Extraction on 2s non-overlapping windows
// Source units assumed microvolts (µV). Outputs consistent if units differ.

export type EEGFeatures = {
  // Absolute powers (µV²)
  delta_power: number;
  theta_power: number;
  alpha_power: number;
  beta_power: number;
  gamma_power: number;
  // Relative powers (0-1)
  delta_relative: number;
  theta_relative: number;
  alpha_relative: number;
  beta_relative: number;
  gamma_relative: number;
  // Peak freq (Hz)
  delta_peak_freq: number;
  theta_peak_freq: number;
  alpha_peak_freq: number;
  beta_peak_freq: number;
  gamma_peak_freq: number;
  // Peak amplitudes (µV²/Hz)
  delta_peak_amp: number;
  theta_peak_amp: number;
  alpha_peak_amp: number;
  beta_peak_amp: number;
  gamma_peak_amp: number;
  // Composite
  alpha_theta_ratio: number;
  beta_alpha_ratio: number;
  total_power: number;
  theta_contribution: number;
};

export type FeatureRecord = EEGFeatures & {
  t0: number; // window start ms
  t1: number; // window end ms
  fs: number; // sample rate
};

export type EEGFeatureExtractorConfig = {
  fs: number;
  windowSec?: number; // default 2.0
  onWindow?: (rec: FeatureRecord) => void;
  debug?: boolean;
};

const EPS = 1e-12;

function hann(N: number): Float64Array {
  const w = new Float64Array(N);
  for (let n = 0; n < N; n++) w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
  return w;
}

function nearestPow2(n: number): number {
  return 1 << Math.round(Math.log2(n));
}

// Minimal radix-2 FFT (Cooley–Tukey, in-place). For production, consider a native lib.
function fftRealToComplexInPlace(re: Float64Array, im: Float64Array): void {
  const N = re.length;
  // bit-reversal
  let j = 0;
  for (let i = 0; i < N; i++) {
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
    let m = N >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  // stages
  for (let s = 1; s <= Math.log2(N); s++) {
    const m = 1 << s;
    const m2 = m >> 1;
    const theta = (-2 * Math.PI) / m;
    const wpr = Math.cos(theta);
    const wpi = Math.sin(theta);
    for (let k = 0; k < N; k += m) {
      let wr = 1.0, wi = 0.0;
      for (let t = 0; t < m2; t++) {
        const i = k + t;
        const j = i + m2;
        const tr = wr * re[j] - wi * im[j];
        const ti = wr * im[j] + wi * re[j];
        re[j] = re[i] - tr;
        im[j] = im[i] - ti;
        re[i] += tr;
        im[i] += ti;
        const tmp = wr;
        wr = tmp * wpr - wi * wpi;
        wi = tmp * wpi + wi * wpr;
      }
    }
  }
}

function oneSidedPSD(x: Float64Array, fs: number): { psd: Float64Array; freqs: Float64Array } {
  const N = x.length;
  const im = new Float64Array(N);
  fftRealToComplexInPlace(x, im);
  // Scale for one-sided PSD with window power normalization
  const nfft = N;
  const two = 2;
  const scale = 1 / (fs * nfft);
  const half = Math.floor(nfft / 2);
  const psd = new Float64Array(half + 1);
  // window power accounted outside
  for (let k = 0; k <= half; k++) {
    const mag2 = x[k] * x[k] + im[k] * im[k];
    let val = mag2 * scale;
    if (k !== 0 && k !== half) val *= two; // one-sided doubling except DC/Nyquist
    psd[k] = val;
  }
  const freqs = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) freqs[k] = (k * fs) / nfft;
  return { psd, freqs };
}

function integrateBand(psd: Float64Array, freqs: Float64Array, f0: number, f1: number): number {
  let sum = 0;
  for (let i = 1; i < freqs.length; i++) {
    const fPrev = freqs[i - 1];
    const fCur = freqs[i];
    const fa = Math.max(fPrev, f0);
    const fb = Math.min(fCur, f1);
    if (fb <= fa) continue;
    // linear interpolate psd across [fPrev,fCur]
    const pPrev = psd[i - 1];
    const pCur = psd[i];
    const wPrev = (fa - fPrev) / (fCur - fPrev);
    const wCur = (fb - fPrev) / (fCur - fPrev);
    const pa = pPrev + (pCur - pPrev) * wPrev;
    const pb = pPrev + (pCur - pPrev) * wCur;
    sum += 0.5 * (pa + pb) * (fb - fa);
  }
  return sum;
}

function bandPeak(psd: Float64Array, freqs: Float64Array, f0: number, f1: number): { freq: number; amp: number } {
  let bestIdx = -1;
  let best = -Infinity;
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    if (f < f0 || f > f1) continue;
    const p = psd[i];
    if (p > best) { best = p; bestIdx = i; }
  }
  if (bestIdx < 0) return { freq: (f0 + f1) / 2, amp: 0 };
  return { freq: freqs[bestIdx], amp: psd[bestIdx] };
}

export class EEGFeatureExtractor {
  private fs: number;
  private windowSec: number;
  private onWindow?: (rec: FeatureRecord) => void;
  private debug: boolean;
  private buffer: Float64Array;
  private bufLen: number;
  private writeIdx: number;
  private nextWindowStartMs: number;
  private hannWin: Float64Array;
  private winPow: number;
  private nfft: number;

  constructor(cfg: EEGFeatureExtractorConfig) {
    this.fs = cfg.fs;
    this.windowSec = cfg.windowSec ?? 2.0;
    this.onWindow = cfg.onWindow;
    this.debug = !!cfg.debug;
    this.bufLen = Math.round(this.fs * this.windowSec);
    this.buffer = new Float64Array(this.bufLen);
    this.writeIdx = 0;
    this.nextWindowStartMs = Date.now();
    const N0 = this.bufLen;
    this.nfft = nearestPow2(N0);
    this.hannWin = hann(N0);
    // window power (sum of squares) for PSD normalization
    let wp = 0;
    for (let i = 0; i < N0; i++) wp += this.hannWin[i] * this.hannWin[i];
    this.winPow = wp;
  }

  pushChunk(samples: number[], nowMs?: number) {
    const ts = nowMs ?? Date.now();
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIdx++] = samples[i];
      if (this.writeIdx === this.bufLen) {
        // full window ready
        const t1 = ts; // approximate end time
        const t0 = t1 - Math.round(1000 * this.windowSec);
        const rec = this.computeWindow(t0, t1);
        if (this.onWindow) this.onWindow(rec);
        this.writeIdx = 0; // non-overlapping
        this.nextWindowStartMs = t1;
      }
    }
  }

  private computeWindow(t0: number, t1: number): FeatureRecord {
    const N = this.bufLen;
    // copy and zero-mean
    const x = new Float64Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) mean += this.buffer[i];
    mean /= N;
    for (let i = 0; i < N; i++) x[i] = (this.buffer[i] - mean) * this.hannWin[i];

    // zero-pad/trim to nfft for FFT
    let xr: Float64Array;
    if (this.nfft === N) {
      xr = x;
    } else if (this.nfft > N) {
      xr = new Float64Array(this.nfft);
      xr.set(x);
    } else {
      xr = x.subarray(0, this.nfft) as unknown as Float64Array;
    }

    const { psd, freqs } = oneSidedPSD(xr, this.fs);
    // normalize by window power
    const psdNorm = new Float64Array(psd.length);
    for (let i = 0; i < psd.length; i++) psdNorm[i] = psd[i] / (this.winPow + EPS);

    // bands
    const B = {
      delta: [0.5, 4],
      theta: [4, 8],
      alpha: [8, 12],
      beta: [12, 30],
      gamma: [30, 80],
    } as const;

    const delta_power = integrateBand(psdNorm, freqs, B.delta[0], B.delta[1]);
    const theta_power = integrateBand(psdNorm, freqs, B.theta[0], B.theta[1]);
    const alpha_power = integrateBand(psdNorm, freqs, B.alpha[0], B.alpha[1]);
    const beta_power = integrateBand(psdNorm, freqs, B.beta[0], B.beta[1]);
    const gamma_power = integrateBand(psdNorm, freqs, B.gamma[0], B.gamma[1]);

    const total_power = integrateBand(psdNorm, freqs, 0.5, 80);

    // peaks
    const { freq: delta_peak_freq, amp: delta_peak_amp } = bandPeak(psdNorm, freqs, B.delta[0], B.delta[1]);
    const { freq: theta_peak_freq, amp: theta_peak_amp } = bandPeak(psdNorm, freqs, B.theta[0], B.theta[1]);
    const { freq: alpha_peak_freq, amp: alpha_peak_amp } = bandPeak(psdNorm, freqs, B.alpha[0], B.alpha[1]);
    const { freq: beta_peak_freq, amp: beta_peak_amp } = bandPeak(psdNorm, freqs, B.beta[0], B.beta[1]);
    const { freq: gamma_peak_freq, amp: gamma_peak_amp } = bandPeak(psdNorm, freqs, B.gamma[0], B.gamma[1]);

    // relatives
    const denom = Math.max(total_power, EPS);
    const delta_relative = delta_power / denom;
    const theta_relative = theta_power / denom;
    const alpha_relative = alpha_power / denom;
    const beta_relative = beta_power / denom;
    const gamma_relative = gamma_power / denom;

    // noise floor as median PSD in 30-80 Hz
    const lo = B.gamma[0], hi = B.gamma[1];
    const idxs: number[] = [];
    for (let i = 0; i < freqs.length; i++) if (freqs[i] >= lo && freqs[i] <= hi) idxs.push(i);
    const arr = idxs.map(i => psdNorm[i]).sort((a, b) => a - b);
    const med = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
    const totalNoNoise = Math.max(total_power - med * (80 - 0.5), EPS);
    const theta_contribution = Math.max(0, Math.min(1, (theta_power - med * (B.theta[1] - B.theta[0])) / totalNoNoise));

    const alpha_theta_ratio = alpha_power / Math.max(theta_power, EPS);
    const beta_alpha_ratio = beta_power / Math.max(alpha_power, EPS);

    const rec: FeatureRecord = {
      t0,
      t1,
      fs: this.fs,
      delta_power,
      theta_power,
      alpha_power,
      beta_power,
      gamma_power,
      delta_relative,
      theta_relative,
      alpha_relative,
      beta_relative,
      gamma_relative,
      delta_peak_freq,
      theta_peak_freq,
      alpha_peak_freq,
      beta_peak_freq,
      gamma_peak_freq,
      delta_peak_amp,
      theta_peak_amp,
      alpha_peak_amp,
      beta_peak_amp,
      gamma_peak_amp,
      alpha_theta_ratio,
      beta_alpha_ratio,
      total_power,
      theta_contribution,
    };
    if (this.debug) console.log('[EEGFeatures] Emitted window', new Date(t0).toISOString(), '→', new Date(t1).toISOString());
    return rec;
  }
}
