import test from 'node:test';
import assert from 'node:assert';
import { dateToJd, jdToDate, fmtJdLocal, MIN_JD, MAX_JD } from '../src/sim/timeutil.js';
import { Clock, RATES } from '../src/sim/clock.js';

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
