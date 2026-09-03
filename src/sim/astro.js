// astronomy-engine 封装：EQJ → 黄道系场景坐标（单位 AU，double），含帧缓存与日月食/月相
import { HelioVector, Ecliptic, GeoVector, Illumination, MoonPhase,
  SearchGlobalSolarEclipse, SearchLunarEclipse, SearchMoonPhase, Body, EclipseKind } from 'astronomy-engine';
import { jdToDate, dateToJd } from './timeutil.js';

const DEG = Math.PI / 180;
const BODY_MAP = { sun:'Sun', mercury:'Mercury', venus:'Venus', earth:'Earth', mars:'Mars',
  jupiter:'Jupiter', saturn:'Saturn', uranus:'Uranus', neptune:'Neptune' };

const mag = v => Math.hypot(v.x, v.y, v.z);

// EQJ 向量 → 黄道系场景坐标（右手系，Y 上=黄道北；俯视逆时针）
function eclToScene(v){
  const e = Ecliptic(v);          // {vec, elat, elon}
  const d = mag(v);
  const lat = e.elat * DEG, lon = e.elon * DEG;
  return { x: d*Math.cos(lat)*Math.cos(lon), y: d*Math.sin(lat), z: -d*Math.cos(lat)*Math.sin(lon) };
}

// —— 帧缓存：同一 jd 只算一次 ——
let frameJd = null; const care = new Map(); let moonHelio = null; let moonGeo = null;
export function beginFrame(jd){
  if(jd !== frameJd){ frameJd = jd; care.clear(); moonHelio = null; moonGeo = null; }
}

export function helioScene(bodyId, jd){
  if(bodyId === 'sun') return { x:0, y:0, z:0 };
  beginFrame(jd);
  if(care.has(bodyId)) return care.get(bodyId);
  const v = eclToScene(HelioVector(Body[BODY_MAP[bodyId]], jdToDate(jd)));
  care.set(bodyId, v); return v;
}

export function moonHelioScene(jd){
  beginFrame(jd);
  if(moonHelio) return moonHelio;
  const e = HelioVector(Body.EMB, jdToDate(jd));
  const g = GeoVector(Body.Moon, jdToDate(jd), true);
  moonHelio = eclToScene({ x:e.x+g.x, y:e.y+g.y, z:e.z+g.z, t:e.t });
  return moonHelio;
}

export function moonGeoScene(jd){
  beginFrame(jd);
  if(moonGeo) return moonGeo;
  moonGeo = eclToScene(GeoVector(Body.Moon, jdToDate(jd), true));
  return moonGeo;
}

// 月相：照亮比例 fraction(0=朔..1=望) 与相位角 angle(0..360)
export function getPhase(jd){
  const t = jdToDate(jd);
  const ill = Illumination(Body.Moon, t);
  const ang = MoonPhase(t);
  return { fraction: ill.phase_fraction, angle: ang };
}

// 八相位名（按照亮比例 + 相位角）
export function phaseName(fraction, angle){
  const f = fraction, a = angle;
  if(f < 0.03) return '朔（新月）';
  if(f > 0.97) return '望（满月）';
  if(Math.abs(f-0.5) < 0.05){
    // 上弦=angle≈90，下弦≈270
    return a < 180 ? '上弦月' : '下弦月';
  }
  if(f < 0.5) return a < 180 ? '娥眉月' : '残月';
  return a < 180 ? '盈凸月' : '亏凸月';
}

// 日月食搜索（真实事件）
export function searchEclipses(fromJd, toJd){
  const list = [];
  const solarKind = { [EclipseKind.Partial]:'partial', [EclipseKind.Annular]:'annular', [EclipseKind.Total]:'total' };
  const lunarKind = { penumbral:'penumbral', partial:'partial', total:'total' };

  let t = jdToDate(fromJd);
  for(let i=0;i<40;i++){
    const ev = SearchGlobalSolarEclipse(t); if(!ev) break;
    const peakJd = dateToJd(ev.peak.date);
    if(peakJd > toJd) break;
    if(peakJd >= fromJd && solarKind[ev.kind]) list.push({ type:'solar', kind:solarKind[ev.kind], date:ev.peak.date, jd:peakJd });
    t = new Date(ev.peak.date.getTime() + 3*86400000);
  }
  t = jdToDate(fromJd);
  for(let i=0;i<40;i++){
    const ev = SearchLunarEclipse(t); if(!ev) break;
    const peakJd = dateToJd(ev.peak.date);
    if(peakJd > toJd) break;
    if(peakJd >= fromJd && lunarKind[ev.kind]) list.push({ type:'lunar', kind:lunarKind[ev.kind], date:ev.peak.date, jd:peakJd, obscuration:ev.obscuration });
    t = new Date(ev.peak.date.getTime() + 3*86400000);
  }
  list.sort((a,b)=>a.jd-b.jd);
  return list;
}

// 查找相位角对应的日期（targetAngle: 0=朔,90=上弦,180=望,270=下弦）
export function searchPhase(angleDeg, fromJd){
  const d = SearchMoonPhase(angleDeg, jdToDate(fromJd), 365);
  return d ? (d.ut + 2451545.0) : null;
}
