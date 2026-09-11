import test from 'node:test';
import assert from 'node:assert';
import { dateToJd, jdToDate, fmtJdLocal, MIN_JD, MAX_JD } from '../src/sim/timeutil.js';
import { Clock, RATES } from '../src/sim/clock.js';
import { bus } from '../src/sim/bus.js';

test('JD↔Date 往返（含 1900/2100 边界）', () => {
  [1900, 1950, 2000, 2050, 2100].forEach(y => {
    const jd = dateToJd(new Date(Date.UTC(y, 5, 15, 12)));
    assert.ok(Math.abs(jdToDate(jd).getTime() - new Date(Date.UTC(y,5,15,12)).getTime()) < 1000);
  });
});

test('时钟钳制：越界日期被限制在 1900–2100', () => {
  const c = new Clock();
  c.jump(MIN_JD - 5000);
  assert.ok(c.jd >= MIN_JD);
  c.jump(MAX_JD + 5000);
  assert.ok(c.jd <= MAX_JD);
});

test('倍速表与状态', () => {
  const c = new Clock();
  c.setRate(3);
  assert.equal(c.rateIndex, 3);
  assert.equal(c.rate, RATES[3]);
  c.toggle(); assert.equal(c.running, false);
});

test('fmtJdLocal 可读格式', () => {
  const jd = dateToJd(new Date(Date.UTC(2026, 7, 12, 12, 0)));
  const s = fmtJdLocal(jd, 8);       // +8 UTC
  assert.ok(/^2026-08-12 20:/.test(s), s);
});

test('MAX_JD 覆盖 2100 年全年，而非停在 2100-01-01', () => {
  const d = jdToDate(MAX_JD);
  assert.ok(d.getTime() >= Date.UTC(2100, 11, 31), `MAX_JD 仅到 ${d.toISOString()}，未覆盖 2100 年`);
});

test('时钟越界提示做了去抖，不会每帧刷屏', () => {
  const c = new Clock();
  const toasts = [];
  const off = bus.on('toast', t => toasts.push(t));
  try{
    c.jump(MAX_JD + 5000);                    // 首次越界应提示一次
    for(let i=0;i<60;i++) c.step(1000);       // 随后连续 60 次越界
    assert.ok(toasts.length >= 1, '首次越界应给出提示');
    assert.ok(toasts.length <= 2, `越界提示触发 ${toasts.length} 次，应被去抖`);
  } finally { off(); }
});
