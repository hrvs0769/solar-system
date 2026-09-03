// 全局常量与星体元数据（唯一配置源）
export const AU = 1;                      // 1 场景单位 = 1 AU
export const KM_PER_AU = 1.495978707e8;   // 公里/AU
export const SIZE_FACTOR_PLANET = 1200;   // 行星视觉半径 = 真实 ×1200（教学放大，保证全景可见）
export const SIZE_FACTOR_SUN = 60;        // 太阳视觉半径 = 真实 ×60（+日冕辉光）
export const MOON_ORBIT_SCHEMATIC = 0.16;   // 月地示意轨道半径（AU，须大于地球视觉半径）
export const MOON_RADIUS_SCHEMATIC = 0.02;  // 月球示意视觉半径（AU）

// 「真实比例」模式：轨道距离始终真实（不缩放），天体大小用该系数轻度放大，
// 使孩子仍能看到太阳与各行星（真实尺度下体几乎不可见）；该系数即"稍微失真"。
export const REAL_SIZE_RATIO = 0.22;        // 天体视觉半径 = 教学尺寸 × 0.22
export const MIN_SUN_PX = 15;               // 真实比例下，太阳至少 ~15px 直径（可定位参照）
export const MIN_PLANET_PX = 6;             // 真实比例下，行星至少 ~6px 直径（避免消失）

export const SEED = 20260901;

// 轨道半长轴（AU，用于轨道线采样范围与数据面板）
export const ORBIT_A_AU = { mercury:0.387, venus:0.723, earth:1.0, mars:1.524, jupiter:5.203, saturn:9.537, uranus:19.19, neptune:30.07 };

// 星体基本元数据（教学展示用；详细资料在 data/planet-facts.js）
export const BODIES = [
  { id:'sun',      name_zh:'太阳', name_en:'Sun',      color:'#ffb454', radiusKm:696340, obliquityDeg:7.25, siderealDays:25.38, periodDays:365.25, sizeFactor:SIZE_FACTOR_SUN,  atmosphere:null },
  { id:'mercury',  name_zh:'水星', name_en:'Mercury',  color:'#b8a89a', radiusKm:2439.7,   obliquityDeg:0.03,  siderealDays:58.65,  periodDays:88,     sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#c8beb0' },
  { id:'venus',    name_zh:'金星', name_en:'Venus',    color:'#e6c98a', radiusKm:6051.8,   obliquityDeg:177.4, siderealDays:-243.02, periodDays:224.7, sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#e8d5a0' },
  { id:'earth',    name_zh:'地球', name_en:'Earth',    color:'#4f8fe0', radiusKm:6371.0,   obliquityDeg:23.44, siderealDays:0.9973,  periodDays:365.25, sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#7fb2ff', clouds:true },
  { id:'mars',     name_zh:'火星', name_en:'Mars',     color:'#d1603f', radiusKm:3389.5,   obliquityDeg:25.19, siderealDays:1.026,   periodDays:687,    sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#e0a080', clouds:false },
  { id:'jupiter',  name_zh:'木星', name_en:'Jupiter',  color:'#d9b48a', radiusKm:69911,    obliquityDeg:3.13,  siderealDays:0.4135,  periodDays:4333,   sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#c8b294', clouds:false },
  { id:'saturn',   name_zh:'土星', name_en:'Saturn',   color:'#e3c89a', radiusKm:58232,    obliquityDeg:26.73, siderealDays:0.444,   periodDays:10759,  sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#e0cfae', clouds:false, rings:true },
  { id:'uranus',   name_zh:'天王星', name_en:'Uranus', color:'#a8d4dd', radiusKm:25362,    obliquityDeg:97.77, siderealDays:-0.718,  periodDays:30688,  sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#b8dde6', clouds:false },
  { id:'neptune',  name_zh:'海王星', name_en:'Neptune', color:'#5b7fe0', radiusKm:24622,    obliquityDeg:28.32, siderealDays:0.671,   periodDays:60182,  sizeFactor:SIZE_FACTOR_PLANET, atmosphere:'#6f9fe6', clouds:false },
];

export const LUNA = {
  id:'moon', name_zh:'月球', name_en:'Moon', color:'#cccccc', radiusKm:1737.4, obliquityDeg:6.68, siderealDays:27.32,
  sizeFactor: SIZE_FACTOR_PLANET,
};

// 键盘快捷键映射
export const KEYS = {
  SPACE:'togglePlay', MINUS:'rateDown', EQUAL:'rateUp', BRACKETLEFT:'stepBack', BRACKETRIGHT:'stepFwd',
  DIGIT0:'focus:0', DIGIT1:'focus:1', DIGIT2:'focus:2', DIGIT3:'focus:3', DIGIT4:'focus:4',
  DIGIT5:'focus:5', DIGIT6:'focus:6', DIGIT7:'focus:7', DIGIT8:'focus:8', KEYM:'focus:9',
  KEYL:'toggleLabels', KEYH:'cleanMode', F1:'help', KEYR:'reset',
};
export const FOCUS_INDEX = ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon'];

// 行星 UI 颜色（轨道线/菜单点）
export const bodyColor = id => (BODIES.find(b=>b.id===id)||LUNA).color;
