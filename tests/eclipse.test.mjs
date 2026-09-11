import test from 'node:test';
import assert from 'node:assert';
import { eclipseState, searchEclipses } from '../src/sim/astro.js';
import { dateToJd } from '../src/sim/timeutil.js';

// 2026 年真实日月食峰值时刻（与权威目录一致，见 astro.regression.test.mjs）
const SOLAR_TOTAL   = Date.UTC(2026, 7, 12, 17, 45);
const SOLAR_ANNULAR = Date.UTC(2026, 1, 17, 12, 11);
const LUNAR_TOTAL   = Date.UTC(2026, 2,  3, 11, 33);
const LUNAR_PARTIAL = Date.UTC(2026, 7, 28,  4, 12);

test('日食峰值时刻判定为日食', () => {
  for(const [t, label] of [[SOLAR_TOTAL, '日全食'], [SOLAR_ANNULAR, '日环食']]){
    const s = eclipseState(dateToJd(new Date(t)));
    assert.ok(s.solar, `${label} 应判定为日食（黄纬 ${s.latDeg.toFixed(2)}°，距朔 ${s.elongDeg.toFixed(2)}°）`);
    assert.ok(!s.lunar, `${label} 不应判定为月食`);
  }
});

test('月食峰值时刻判定为月食', () => {
  for(const [t, label] of [[LUNAR_TOTAL, '月全食'], [LUNAR_PARTIAL, '月偏食']]){
    const s = eclipseState(dateToJd(new Date(t)));
    assert.ok(s.lunar, `${label} 应判定为月食（黄纬 ${s.latDeg.toFixed(2)}°，距望 ${(180 - s.elongDeg).toFixed(2)}°）`);
    assert.ok(!s.solar, `${label} 不应判定为日食`);
  }
});

test('朔月但远离黄白交点不应判定为日食', () => {
  // 2026-03-19 为朔（新月），但月球黄纬约 2.3°，不构成日食
  const s = eclipseState(dateToJd(new Date(Date.UTC(2026, 2, 19, 12))));
  assert.ok(!s.solar, `朔月但黄纬 ${s.latDeg.toFixed(2)}° 不应判定为日食`);
  assert.ok(!s.lunar, '朔月不应判定为月食');
});

test('望月但远离黄白交点不应判定为月食', () => {
  // 2026-01-03 为望（满月），但月球黄纬约 4.2°，不构成月食
  const s = eclipseState(dateToJd(new Date(Date.UTC(2026, 0, 3, 12))));
  assert.ok(!s.lunar, `望月但黄纬 ${s.latDeg.toFixed(2)}° 不应判定为月食`);
  assert.ok(!s.solar, '望月不应判定为日食');
});

test('上弦月不应判定为任何食相', () => {
  // 旧判据 mdir.dot(sdir) > 0.5 会把上弦月误判为月食
  const s = eclipseState(dateToJd(new Date(Date.UTC(2026, 5, 25, 12))));
  assert.ok(!s.solar && !s.lunar, `上弦月不应判定为食相（黄纬 ${s.latDeg.toFixed(2)}°）`);
});

test('全年食相时段数与真实事件数精确一致', () => {
  // 逐小时扫描：既不能漏报真实食相，也不能把普通朔望误报成食相
  const from = dateToJd(new Date(Date.UTC(2026, 0, 1)));
  let solarRuns = 0, lunarRuns = 0, prevSolar = false, prevLunar = false;
  for(let h = 0; h < 365*24; h++){
    const s = eclipseState(from + h/24);
    if(s.solar && !prevSolar) solarRuns++;
    if(s.lunar && !prevLunar) lunarRuns++;
    prevSolar = s.solar; prevLunar = s.lunar;
  }
  const real = searchEclipses(from, from + 365);
  const realSolar = real.filter(e => e.type === 'solar').length;
  const realLunar = real.filter(e => e.type === 'lunar').length;
  assert.equal(solarRuns, realSolar, `日食时段数应为 ${realSolar}`);
  assert.equal(lunarRuns, realLunar, `月食时段数应为 ${realLunar}`);
});
