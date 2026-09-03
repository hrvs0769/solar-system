// 时间工具：JD ↔ Date（UTC 基准）
export const MIN_JD = 2415020.5;   // 1900-01-01
export const MAX_JD = 2488070.0;   // 2100-12-31

export function jdToDate(jd){ return new Date((jd - 2440587.5) * 86400000); }
export function dateToJd(date){ return date.getTime() / 86400000 + 2440587.5; }

export function fmtJd(jd){
  const d = jdToDate(jd);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtJdDate(jd){
  const d = jdToDate(jd);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
export function fmtJdLocal(jd, tzOffsetHours){
  const d = new Date(jdToDate(jd).getTime() + tzOffsetHours*3600000);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
