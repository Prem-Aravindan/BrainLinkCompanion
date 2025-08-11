// Tiny test harness: simulate 10 min of fs=512 signal with alpha/theta components
// Run via Node/Metro environment (ts-node or jest). Here we export a function to be called from a test.

import { EEGFeatureExtractor, FeatureRecord } from './features';

export async function simulateTenMinutes({
  fs = 512,
  minutes = 10,
  alphaHz = 10,
  thetaHz = 6,
}: { fs?: number; minutes?: number; alphaHz?: number; thetaHz?: number }) {
  const durationSec = minutes * 60;
  const totalSamples = fs * durationSec;
  const out: FeatureRecord[] = [];
  const extractor = new EEGFeatureExtractor({ fs, windowSec: 2.0, onWindow: (r) => out.push(r) });
  const dt = 1 / fs;
  let t = 0;
  for (let i = 0; i < totalSamples; i++) {
    // alpha 30 uVpp + theta 20 uVpp
    const sample = 15 * Math.sin(2 * Math.PI * alphaHz * t) + 10 * Math.sin(2 * Math.PI * thetaHz * t);
    extractor.pushChunk([sample], Math.round(t * 1000));
    t += dt;
  }
  // Report
  const posts = Math.ceil(out.length / 20); // expected <= 30 for 300 vectors
  return { count: out.length, posts, first: out[0], last: out[out.length - 1] };
}
