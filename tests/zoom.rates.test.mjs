import test from 'node:test';
import assert from 'node:assert';
import { zoomDist, zoomV } from '../src/sim/camera.js';
import { RATES, RATE_LABELS } from '../src/sim/clock.js';

test('缩放映射：v=1 最近，v=0 最远', () => {
  const MIN=0.002, MAX=55;
  assert.ok(Math.abs(zoomDist(1, MIN, MAX) - MIN) < 1e-9);
  assert.ok(Math.abs(zoomDist(0, MIN, MAX) - MAX) < 1e-9);
  const mid = zoomDist(0.5, MIN, MAX);
  assert.ok(mid > MIN && mid < MAX);
  // 往返一致
  assert.ok(Math.abs(zoomV(zoomDist(0.37, MIN, MAX), MIN, MAX) - 0.37) < 1e-9);
  assert.equal(zoomV(0.001, MIN, MAX), 1);
  assert.equal(zoomV(100, MIN, MAX), 0);
});

test('倍速档为 6 档且与文案一一对应', () => {
  assert.equal(RATES.length, 6);
  assert.equal(RATE_LABELS.length, 6);
  assert.equal(RATES[0], 0);          // 暂停
  assert.ok(RATES[5] === 1);          // 最快 1 天/秒
  RATE_LABELS.forEach(l => assert.ok(/秒|暂停/.test(l)));
});
