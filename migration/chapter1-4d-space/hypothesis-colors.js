import {CELL_COLORS} from './colored-tesseract.js';
/** Proposed observation-color correspondence, NOT a proof of actual cell topology. */
export const HYPOTHESIS_ROOM_CORRESPONDENCE=Object.freeze({H1:'W+',H2:'X+',H3:'W-',H4:'X-',HC:'Y+',HR1:'Y-',T1:'W+',T2:'X+',T3:'W-',T4:'X-',TL1:'Y+',TR1:'Y-',S1:'W+',S2:'X+',S3:'W-',S4:'X-',SN:'Y+',SS:'Y-'});
export const HYPOTHESIS_ROOM_COLORS=Object.freeze(Object.fromEntries(Object.entries(HYPOTHESIS_ROOM_CORRESPONDENCE).map(([id,cell])=>[id,CELL_COLORS[cell]])));
export function hypothesisRoomColor(id){if(!Object.hasOwn(HYPOTHESIS_ROOM_COLORS,id))throw Error('Unknown hypothesis-local room '+id);return HYPOTHESIS_ROOM_COLORS[id];}
/** Richer equator surfaces retain the exact hue/identity mapping; other rooms unchanged. */
export function hypothesisSurfaceColor(id){const c=hypothesisRoomColor(id);return /^S[1-4]$/.test(id)?'#'+[1,3,5].map(i=>Math.round(parseInt(c.slice(i,i+2),16)*.72).toString(16).padStart(2,'0')).join(''):c;}
