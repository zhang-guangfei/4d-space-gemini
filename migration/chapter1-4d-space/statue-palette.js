import {STATUE_COLORS} from './statue-placement.js';
export const STATUE_VARIANTS={bronze:'A',stone:'B'};
export function statuePaletteBytes(kind){const color=STATUE_COLORS[kind];if(!color)throw Error('Unknown statue palette '+kind);return new Uint8Array([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).concat(255));}
export function createStatuePalette(B,scene,kind){const texture=new B.RawTexture(statuePaletteBytes(kind),1,1,B.Engine.TEXTUREFORMAT_RGBA,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);texture.name='classical marble '+kind;texture.wrapU=B.Texture.CLAMP_ADDRESSMODE;texture.wrapV=B.Texture.CLAMP_ADDRESSMODE;texture.metadata={statueVariant:STATUE_VARIANTS[kind],marble:true};return texture;}
