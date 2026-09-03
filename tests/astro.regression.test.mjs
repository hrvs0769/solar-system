import test from 'node:test';
import assert from 'node:assert';
import { helioScene, moonGeoScene, getPhase, phaseName, searchEclipses, searchPhase } from '../src/sim/astro.js';
import { dateToJd } from '../src/sim/timeutil.js';

const lon = p => Math.atan2(-p.z, p.x) * 180 / Math.PI;

test('J2000 地球日心位置（黄经 100.375°，距离 0.9833 AU）', () => {
  const p = helioScene('earth', 2451545.0);
  const dist = Math.hypot(p.x, p.y, p.z);
  assert.ok(Math.abs(dist - 0.9833) < 0.01, `dist ${dist}`);
  assert.ok(Math.abs(lon(p) - 100.375) < 1.0, `lon ${lon(p)}`);
});

test('J2000 地月距离 ≈ 0.0026 AU', () => {
  const g = moonGeoScene(2451545.0);
  const d = Math.hypot(g.x, g.y, g.z);
  assert.ok(d > 0.0022 && d < 0.0030, `d ${d}`);
});

test('月相：2026-03-03 望（满月），2026-08-12 朔（新月）', () => {
  const full = getPhase(dateToJd(new Date(Date.UTC(2026, 2, 3, 11, 33))));
  assert.ok(full.fraction >= 0.99, `full ${full.fraction}`);
  const newm = getPhase(dateToJd(new Date(Date.UTC(2026, 7, 12, 17, 46))));
  assert.ok(newm.fraction <= 0.05, `new ${newm.fraction}`);
});

test('日月食：2026 年四次事件与权威目录一致', () => {
  const from = dateToJd(new Date(Date.UTC(2026, 0, 1)));
  const to = dateToJd(new Date(Date.UTC(2027, 0, 1)));
  const evs = searchEclipses(from, to);
  const byType = (type, kind) => evs.find(e => e.type === type && e.kind === kind);
  assert.ok(byType('solar','annular'), '缺 日环食');
  assert.ok(byType('solar','total'), '缺 日全食');
  assert.ok(byType('lunar','total'), '缺 月全食');
  assert.ok(byType('lunar','partial'), '缺 月偏食');
});

test('月相预设：searchPhase(180) 应落在望附近', () => {
  const jd = searchPhase(180, dateToJd(new Date(Date.UTC(2026,0,1))));
  assert.ok(jd != null, 'no phase');
  const ph = getPhase(jd);
  assert.ok(ph.fraction >= 0.97, `frac ${ph.fraction}`);
});

test('相位名映射', () => {
  assert.ok(phaseName(0.001, 0).includes('朔'));
  assert.ok(phaseName(0.999, 180).includes('望'));
  assert.ok(phaseName(0.5, 90).includes('上弦'));
  assert.ok(phaseName(0.5, 270).includes('下弦'));
});
