// 贴图缓存与降级链：真实贴图(public/textures) → 程序化回退；物理资源缓存，供模块复用
import * as THREE from 'three';
import { getFallbackTexture, getFallbackClouds } from './procedural-textures.js';

const FILE = {
  sun:'2k_sun.jpg', mercury:'2k_mercury.jpg', venus:'2k_venus_atmosphere.jpg', earth:'2k_earth_daymap.jpg',
  mars:'2k_mars.jpg', jupiter:'2k_jupiter.jpg', saturn:'2k_saturn.jpg', uranus:'2k_uranus.jpg',
  neptune:'2k_neptune.jpg', moon:'2k_moon.jpg',
};
const CLOUD_FILE = '2k_earth_clouds.jpg';
const RING_FILE = '2k_saturn_ring_alpha.png';

const base = () => {
  const b = (import.meta.env && import.meta.env.BASE_URL) || './';
  return `${b}textures/`;
};

export class TextureStore {
  constructor(){
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();          // key -> THREE.Texture
    this._pending = new Map();       // key -> Promise
    this.tier = 'high';              // high|mid|low；low 时真实贴图降到约 1K
  }
  setTier(t){ this.tier = t; }
  // 低档：把真实贴图降采样到一半分辨率（省显存/带宽，离线无感）
  _downscale(tex){
    const img = tex.image;
    if(!img || !img.width || !img.height) return tex;
    const w = Math.max(2, Math.round(img.width/2)), h = Math.max(2, Math.round(img.height/2));
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    tex.dispose();
    return t;
  }
  _loadReal(filename, fallback){
    const key = filename;
    if(this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if(this._pending.has(key)) return this._pending.get(key);
    const p = new Promise(resolve => {
      const done = tex => { this.cache.set(key, tex); resolve(tex); };
      this.loader.load(base()+filename, tex => {
        tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4;
        if(this.tier==='low' && tex.image) tex = this._downscale(tex);
        done(tex);
      }, undefined, () => done(fallback) );
    });
    this._pending.set(key, p); return p;
  }
  // 行星表面贴图
  surface(bodyId){
    const file = FILE[bodyId];
    if(this.cache.has(file)) return Promise.resolve(this.cache.get(file));
    return this._loadReal(file, getFallbackTexture(bodyId));
  }
  clouds(){
    const file = CLOUD_FILE;
    if(this.cache.has(file)) return Promise.resolve(this.cache.get(file));
    return this._loadReal(file, getFallbackClouds());
  }
  ring(){
    const file = RING_FILE;
    if(this.cache.has(file)) return Promise.resolve(this.cache.get(file));
    return this._loadReal(file, null);
  }
  dispose(){ this.cache.forEach(t=>t.dispose()); this.cache.clear(); }
}

// 单例
export const textureStore = new TextureStore();
