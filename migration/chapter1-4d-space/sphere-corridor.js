export const SPHERE_CORRIDOR_BORDER=Object.freeze({radius:.004,color:'#252b30'});
export const SPHERE_CORRIDOR=Object.freeze({innerRadius:1.10,outerRadius:1.75,halfWidth:.24,segmentsPerSector:24,widthSegments:8});
/** Four connected curved rooms inside a sphere: radial floor outside, roof inward.
 * S1 is centered on +Z; coordinates relative to sphere center. No seam end-walls.
 */
export function sphereCorridorGeometry({innerRadius=SPHERE_CORRIDOR.innerRadius,outerRadius=SPHERE_CORRIDOR.outerRadius,halfWidth=SPHERE_CORRIDOR.halfWidth,segmentsPerSector=SPHERE_CORRIDOR.segmentsPerSector,widthSegments=SPHERE_CORRIDOR.widthSegments}={}){
 if(!(innerRadius>halfWidth&&halfWidth>0&&outerRadius>innerRadius&&Number.isInteger(segmentsPerSector)&&segmentsPerSector>=4&&Number.isInteger(widthSegments)&&widthSegments>=2))throw Error('Invalid sphere corridor dimensions');
 return Array.from({length:4},(_,k)=>{const startAngle=-Math.PI/4+k*Math.PI/2,endAngle=startAngle+Math.PI/2,positions=[],indices=[],outlines=[];
 const point=(a,r,y)=>{const h=Math.sqrt(r*r-y*y);return [Math.sin(a)*h,y,Math.cos(a)*h];};
 function surface(rows){const offset=positions.length/3;for(const [r,y]of rows)for(let i=0;i<=segmentsPerSector;i++)positions.push(...point(startAngle+(endAngle-startAngle)*i/segmentsPerSector,r,y));for(let j=0;j<rows.length-1;j++)for(let i=0;i<segmentsPerSector;i++){const a=offset+j*(segmentsPerSector+1)+i,b=a+segmentsPerSector+1;indices.push(a,b,a+1,a+1,b,b+1);}}
 for(const r of [outerRadius,innerRadius])surface(Array.from({length:widthSegments+1},(_,j)=>[r,-halfWidth+2*halfWidth*j/widthSegments]));
 for(const y of [-halfWidth,halfWidth])surface([[innerRadius,y],[outerRadius,y]]);
 for(const r of [innerRadius,outerRadius])for(const y of [-halfWidth,halfWidth])outlines.push(Array.from({length:segmentsPerSector+1},(_,i)=>point(startAngle+(endAngle-startAngle)*i/segmentsPerSector,r,y)));
 return {id:'S'+(k+1),startAngle,endAngle,positions,indices,outlines,innerRadius,outerRadius,halfWidth};});
}
