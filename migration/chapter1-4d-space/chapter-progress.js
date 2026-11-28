import {H} from './room-dimensions.js';
/** Pure chapter progression. Times are monotonic seconds; depth is world units.
 * onCross is called for every real seam crossing. updateInterior commits an
 * entry only after penetration >= entryDepth and a cooldown. Compute depth as
 * min(H - abs(localCoordinate)) over the three tangent axes. Boundary jitter
 * cannot add route entries. Survey all eight cells three times first, then
 * explicitly start the non-repeating challenge from W+. Upper visits do not count.
 */
export const CELL_IDS=Object.freeze(['W+','X+','W-','X-','Y+','Y-','Z+','Z-']);
// Legacy canonical hypothesis keys are independent of exhibit room placement; UI passes model base names.
export const MODEL_IDS=Object.freeze(['W+','X+','W-']);
export const UPPER_MODEL_IDS=MODEL_IDS;
const LOOP=['W+','X+','W-','X-','W+'];
const canonical=id=>typeof id==='string'?id.replaceAll('−','-'):id;
const validCell=id=>CELL_IDS.includes(canonical(id));
export class ChapterProgress {
  constructor({halfSize=H,entryDepth=.8,cooldown=.7}={}){
    if(!(halfSize>0&&entryDepth>0&&entryDepth<halfSize&&cooldown>=0))throw new RangeError('Invalid progression configuration.');
    this.halfSize=halfSize;this.entryDepth=entryDepth;this.cooldown=cooldown;this.reset();
  }
  reset(){
    this.phase='upper';this.currentCell='W+';this.loopIndex=0;this.loopComplete=false;
    this.inspected=new Set();this.truthRevealed=false;this.truthViewed=false;this.counts=Object.fromEntries(CELL_IDS.map(id=>[id,0]));
    this.lastCommittedCell=null;this.lastCommitTime=-Infinity;this.pending=null;
    this.routeActive=false;this.routeTrail=[];this.routeComplete=false;this.routeFailure=null;
    this.debugUsed=false;this.completed=false;
  }
  modelKey(id){id=canonical(id);return ({'central-hall':'W+','treadmill':'X+','sphere':'W-','X-':'W+','Y+':'W+','Y-':'X+','Z+':'W-','Z-':'W-'})[id]||id;}
  hasModel(id){return this.inspected.has(this.modelKey(id));}
  inspectModel(id){id=this.modelKey(id);if(!['upper','lower'].includes(this.phase)||!MODEL_IDS.includes(id))return false;this.inspected.add(id);if(this.allModelsInspected)this.truthRevealed=true;return true;}
  viewTruth(id=this.currentCell){id=canonical(id);if(!['upper','lower'].includes(this.phase)||!this.truthRevealed||id!=='W+'||this.currentCell!=='W+')return false;this.truthViewed=true;return true;}
  get canUnlock(){return this.phase==='upper'&&this.allModelsInspected&&this.truthViewed;}
  onCross(id,time){
    id=canonical(id);if(!validCell(id)||!Number.isFinite(time)||this.completed)return false;
    const previous=this.currentCell;this.currentCell=id;
    if(previous===id)return false;
    if(this.phase==='upper'){
      if(!this.loopComplete){
        if(id===LOOP[this.loopIndex+1]&&previous===LOOP[this.loopIndex])this.loopIndex++;
        else this.loopIndex=previous==='W+'&&id==='X+'?1:0;
        if(this.loopIndex===4)this.loopComplete=true;
      }
      return false;
    }
    if(this.phase!=='lower')return false;
    this.pending=id===this.lastCommittedCell?null:{cell:id,crossedAt:time};
    return false;
  }
  unlockLower(id=this.currentCell,time=0){
    id=canonical(id);
    if(!this.canUnlock||id!=='W+'||this.currentCell!=='W+'||!Number.isFinite(time))return false;
    this.phase='lower';this.counts=Object.fromEntries(CELL_IDS.map(cell=>[cell,0]));
    this.counts['W+']=1;this.lastCommittedCell='W+';this.lastCommitTime=time;this.pending=null;
    // Free exploration is not a route attempt. The player chooses when to begin.
    return true;
  }
  get surveyComplete(){return CELL_IDS.every(id=>this.counts[id]>=3);}
  startRoute(id=this.currentCell){
    id=canonical(id);
    if(this.phase!=='lower'||this.completed||this.routeComplete||!this.surveyComplete||id!=='W+'||this.currentCell!=='W+')return false;
    this.routeActive=true;this.routeTrail=[id];this.routeFailure=null;
    // The challenge always begins in W+, after the completed survey.
    this.lastCommittedCell=id;this.pending=null;return true;
  }
  updateInterior(id,depth,time){
    id=canonical(id);
    if(this.phase!=='lower'||this.completed||!Number.isFinite(depth)||!Number.isFinite(time)||depth<this.entryDepth||depth>this.halfSize+1e-8)return false;
    if(!this.pending||id!==this.currentCell||id!==this.pending.cell||id===this.lastCommittedCell)return false;
    if(time<this.pending.crossedAt||time-this.lastCommitTime+1e-9<this.cooldown)return false;
    this.counts[id]++;this.lastCommittedCell=id;this.lastCommitTime=time;this.pending=null;
    if(this.routeActive){
      if(this.routeTrail.includes(id)){this.routeFailure={cell:id,reason:'repeat'};this.routeActive=false;}
      else {this.routeTrail.push(id);if(this.routeTrail.length===CELL_IDS.length){this.routeComplete=true;this.routeActive=false;}}
    }
    return true;
  }
  get allModelsInspected(){return MODEL_IDS.every(id=>this.inspected.has(id));}
  bubbleVisible(id=this.currentCell){return this.phase==='lower'&&!this.completed&&canonical(id)==='W+'&&this.routeComplete;}
  enterBubble(id=this.currentCell){if(this.currentCell!=='W+'||!this.bubbleVisible(id))return false;this.completed=true;this.phase='ended';this.pending=null;this.routeActive=false;return true;}
  /** Explicit test-only actions; never called by normal exploration. */
  debugCompleteSurvey(){if(this.phase!=='lower'||this.completed)return false;for(const id of CELL_IDS)this.counts[id]=Math.max(this.counts[id],3);this.debugUsed=true;return true;}
  debugCompleteRoute(){if(this.phase!=='lower'||this.completed)return false;this.debugCompleteSurvey();this.routeComplete=true;this.routeActive=false;this.routeFailure=null;this.debugUsed=true;return true;}
  /** Separate test action: route completion never inspects a room's model. */
  debugInspectAll(){if(!['upper','lower'].includes(this.phase)||this.completed)return false;for(const id of MODEL_IDS)this.inspected.add(id);this.truthRevealed=true;this.debugUsed=true;return true;}
  snapshot(){return {phase:this.phase,currentCell:this.currentCell,loopComplete:this.loopComplete,loopSteps:this.loopIndex,inspected:[...this.inspected],truthRevealed:this.truthRevealed,truthViewed:this.truthViewed,canUnlock:this.canUnlock,counts:{...this.counts},pending:this.pending?{...this.pending}:null,surveyComplete:this.surveyComplete,routeActive:this.routeActive,routeTrail:[...this.routeTrail],routeComplete:this.routeComplete,routeFailure:this.routeFailure?{...this.routeFailure}:null,bubbleVisible:this.bubbleVisible(),allModelsInspected:this.allModelsInspected,debugUsed:this.debugUsed,completed:this.completed};}
}
