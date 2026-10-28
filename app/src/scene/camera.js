/* Camera keyframes and paths. A keyframe is {p: finale progress, c: {x,y,z,yaw,pitch,roll}}. */
import {TAU,lerp} from './math.js';
export function lookAt(p,t){const dx=t.x-p.x,dy=t.y-p.y,dz=t.z-p.z;return{yaw:Math.atan2(dx,dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))};}
export function C(p,o){return{p,c:Object.assign({x:0,y:0,z:0,yaw:0,pitch:0,roll:0},o)};}

/* flight through the question pairs: a gentle S-curve toward the core */
export const ZQ0=-9800,ZQ1=-2200;
export function camQ(q){
  return{x:Math.sin(q*TAU*1.5)*140,y:Math.cos(q*TAU*1.2)*70-20,z:lerp(ZQ0,ZQ1,q),
    yaw:Math.sin(q*TAU*1.5+.6)*.05,pitch:Math.cos(q*TAU*1.2)*.02,roll:Math.sin(q*TAU*3)*.035};
}

