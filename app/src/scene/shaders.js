import {WARM,SCENE_WARM,COOL} from './math.js';
/* GLSL ES 3.0 programs of the scene. The vertex shaders place every particle and word:
   the CPU only sends the camera, time and the phase values each frame. */
export const VS_COMMON=`#version 300 es
precision highp float;
uniform float uMode,uQT,uTime,uG,uSpread,uReduced,uF,uT,uEase,uFocal,uDpr,uDetail,uAI,uWalk,uBuild,uSide;
uniform float uLock[6];
uniform vec3 uSeam[6];
uniform vec3 uCamPos;
uniform mat3 uRot;
uniform vec2 uCenter,uRes;
uniform vec4 uCore;

uniform vec3 uSun,uOff;uniform float uOffA;
const vec3 THEME_WARM=vec3(${WARM.map(v=>(v/255).toFixed(8)).join(',')});
const vec3 WORLD_WARM=vec3(${SCENE_WARM.map(v=>(v/255).toFixed(8)).join(',')});
const vec3 THEME_COOL=vec3(${COOL.map(v=>(v/255).toFixed(8)).join(',')});
float easeIO(float t){return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;}
float easeF(float t){if(uEase<.5)return easeIO(t);if(uEase<1.5)return t*t*t;return 1.-pow(1.-t,3.);}
vec3 rotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x*c-v.z*s,v.y,v.x*s+v.z*c);}
/* the core: a soft mass of letters, dense in the middle and thinning out to the edge, slowly breathing. No shells, no lines */
vec3 orb(vec3 d,float k,float ph,float R){
  vec3 q=normalize(d+vec3(1e-4))*R*pow(clamp(k,0.,1.),.75);
  q+=vec3(sin(uTime*.5+ph*6.3),cos(uTime*.43+ph*5.1),sin(uTime*.37+ph*7.7))*R*.06;
  return rotY(q,uTime*.12);
}
vec3 bez(vec3 a,vec3 c,vec3 b,float t){float m=1.-t;return m*m*a+2.*m*t*c+t*t*b;}
vec3 proj(vec3 p){vec3 d=uRot*(p-uCamPos);if(d.z<30.)return vec3(0.,0.,-1.);float s=uFocal/d.z;return vec3(uCenter+d.xy*s,s);}
vec4 clipPos(vec2 px){return vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);}
`;
export const VS_PARTICLE=`
in vec3 aDust;in vec4 aScene;in vec3 aColR;in vec3 aColS;in vec3 aDir;in vec4 aR;in vec3 aV;in vec2 aMD;in float aPhase;in float aCh;
void st(int s,out vec3 p,out float sz,out vec3 c,out float a){
  if(s==0){float ph=aPhase,an=sin(uTime*(.04+.03*fract(ph*3.7))+ph*6.28)*.16,cs=cos(an),sn=sin(an);
    p=vec3(aDust.x*cs-aDust.y*sn,aDust.x*sn+aDust.y*cs,aDust.z)+vec3(sin(uTime*.2+ph)*40.,cos(uTime*.17+ph)*30.,sin(uTime*.13+ph)*60.);sz=5.6;c=aColR*1.05;a=fract(ph*7.13)<.5?0.:.66;}
  else if(s<=2){
    float k=fract(aR.x*3.17+aR.w*1.31),R=uCore.w*(s==2?.22:1.);
    p=uCore.xyz+orb(aDir,k,aR.w,R);sz=s==2?2.5:3.;c=min(mix(aColS*1.4,vec3(1.,.8,.38),pow(1.-k,4.5)),vec3(1.));a=(s==2?.42:.28)*(1.-.55*k);}
  else{p=aScene.xyz;sz=aScene.w;c=aColS;a=1.;}
}
void resolve(out vec3 p,out float sz,out vec3 c,out float a){
  vec3 p0,p1,c0,c1;float s0,s1,a0,a1;
  if(uMode<.5){
    int k=int(aR.y+.5);float te=(uQT-uLock[k]-aR.z)/.15;
    if(te<=0.){st(0,p,sz,c,a);return;}
    if(te>=1.){st(1,p,sz,c,a);return;}
    st(0,p0,s0,c0,a0);st(1,p1,s1,c1,a1);
    if(uReduced>.5){bool b=te>=.5;p=b?p1:p0;sz=b?s1:s0;c=b?c1:c0;a=(b?a1:a0)*abs(2.*te-1.);return;}
    float t=easeIO(te);p=bez(p0,uSeam[k],p1,t);sz=mix(s0,s1,t);c=mix(c0,c1,t);a=max(mix(a0,a1,t),sin(3.14159*t)*1.1);return;
  }
  int f=int(uF+.5),tt=int(uT+.5);
  if(f==tt){st(f,p,sz,c,a);return;}
  st(f,p0,s0,c0,a0);st(tt,p1,s1,c1,a1);
  if(uReduced>.5){bool b=uG>=.5;p=b?p1:p0;sz=b?s1:s0;c=b?c1:c0;float fd=abs(2.*uG-1.);a=(b?a1:a0)*fd;return;}
  float d=f==2?aMD.x:(f>=3?aMD.y:aR.w*.4);
  float t=easeF(clamp((uG-d*uSpread)/(1.-uSpread),0.,1.));
  float dist=length(p1-p0)*.35;p=bez(p0,(p0+p1)*.5+aDir*dist,p1,t);
  sz=mix(s0,s1,t);c=mix(c0,c1,t);a=mix(a0,a1,t);
}
`;
export const VS_POINTS=VS_COMMON+VS_PARTICLE+`
out vec3 vC;out float vA;out float vCh;
void main(){
  vec3 p,c;float sz,a;resolve(p,sz,c,a);p+=uOff;a*=uOffA;
  /* infrastructure ahead of the bridge: letters rise from below and lock into place as the walk goes on */

  if(aV.x<-4.5&&aV.x>-5.5){float t=clamp((uBuild-(aV.z/90.+.5)*.8)/.2,0.,1.),e=t*t*(3.-2.*t);p+=(aDir*420.+vec3(0.,700.,0.))*(1.-e);a*=.15+.85*e;c+=vec3(.5,.6,.7)*sin(3.14159*t)*.8;}
  if(aV.x<-.5&&aV.x>-1.5)a*=clamp((uDetail*1.35-aMD.y)/.35,0.,1.);
  vec3 o=proj(p);vCh=aCh;
  if(o.z<0.||a<.01){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;vC=c;return;}
  float ps=sz*o.z,al=a;
  if(ps<2.5){al*=ps/2.5;ps=2.5;}else if(ps>18.){al*=max(.5,18./ps);ps=min(ps,26.);}
  if(aV.x<-4.5&&aV.x>-5.5)ps=min(ps,10.);
  if(aV.x<-1.5&&aV.x>-2.5)al*=uMode*smoothstep(4.5,9.,ps)*(1.-smoothstep(30.,46.,ps));
  if(aV.x<-2.5&&aV.x>-3.5)al*=uAI;
  /* the picture is laid out for the frontal camera: its letters near that horizon share one height, and from the bridge
     every depth of them crowds into a single glaring line at eye level, so they fade there while walking */
  // The image relief is composed for the frontal view. Replace it with the
  // volumetric towns on side shots, before it can become a wall across the road.
  if(aV.y<0.)al*=1.-uSide;
  if(aV.x<-4.5&&aV.x>-5.5)al*=uAI;else if(aV.x<-3.5&&aV.x>-4.5)al*=uWalk;
  if(aV.x<-4.5&&aV.x>-5.5)al*=smoothstep(100.,460.,length(p-uCamPos));
  float z2=uFocal/o.z;if(aV.y>6.5){if(z2<90.)al*=clamp((z2-25.)/65.,0.,1.);}else if(z2<230.)al*=clamp((z2-30.)/200.,0.,1.);
  /* the road is a matte, lit surface: shaded base, a glossy highlight toward the sun of the picture,
     and the two light pulses running along the bridge light it around them */
  if(aV.y>6.5&&uMode>.5){
    vec3 N=vec3(0.,-1.,0.),V=normalize(uCamPos-p),Ls=normalize(uSun-p);
    float spec=pow(max(dot(reflect(-Ls,N),V),0.),26.);
    // aV.z is the road coordinate: 0..1 on the curved bridge, 1..2 on the approach.
    // Only surface glyphs receive this field; it cannot drift off the deck.
    float phase=fract(aV.z*1.8-uTime*.22);
    float field=exp(-pow((phase-.5)/.14,2.))*uWalk*(1.-uReduced);
    vec3 tint=mix(WORLD_WARM,THEME_COOL,.5+.5*sin(uTime*.65+aV.z*2.));
    vec3 lc=tint*field;
    float rim=pow(1.-abs(dot(N,V)),3.);al*=smoothstep(.07,.28,abs(dot(N,V)));
    c=c*(.44+.12*rim)+vec3(1.,.92,.8)*spec*.3;
    float energy=clamp(max(lc.r,max(lc.g,lc.b)),0.,1.);
    c=mix(c,c*(.8+tint*.6),energy*.32)+lc*.075;
  }
  /* aerial perspective: distance cools and dims, so near things carry the weight */
  vec3 fog=mix(vec3(1.),vec3(.62,.7,.86),smoothstep(2500.,26000.,z2));
  gl_Position=vec4(clipPos(o.xy).xy,1.0010005-60.03*o.z/uFocal,1.);gl_PointSize=ps*uDpr;vC=c*fog;vA=al;
}`;
export const FS_POINTS=`#version 300 es
precision highp float;
uniform sampler2D uGlyph;uniform vec2 uGrid;
in vec3 vC;in float vA;in float vCh;out vec4 o;
void main(){vec2 cell=vec2(mod(vCh,uGrid.x),floor(vCh/uGrid.x+.001));float g=texture(uGlyph,(cell+gl_PointCoord)/uGrid).a*vA;if(g<.01)discard;o=vec4(vC*g,g);}`;
export const VS_WORDS=VS_COMMON+`
in vec4 aWSeam;in vec4 aWDir;in vec4 aWScene;in vec4 aWTan;in vec4 aWCol;in float aWHeight;in vec2 aWDelay;in vec2 aWX;in vec4 aWUV;
out vec2 vUV;out vec3 vCol;out float vA;
const vec3 WARM_S=THEME_WARM;const vec3 COOL_S=THEME_COOL;
void wst(int s,out vec3 p,out float h,out float a){
  if(s==0){int k=int(aWSeam.z+.5);p=uSeam[k]+vec3(aWSeam.xy,0.);h=aWHeight;a=.95;}
  else if(s<=2){float R=(uCore.w+30.)*(s==2?.22:1.);p=uCore.xyz+orb(aWDir.xyz,aWDir.w,aWSeam.w,R);h=s==2?6.:12.;a=0.;}
  else{p=aWScene.xyz;h=aWScene.w;a=aWTan.w;}
}
void main(){
  vec3 p,p0,p1;float h,a,h0,h1,a0,a1,cw=0.,ori=0.;bool hide=false;
  if(uMode<.5){
    int k=int(aWSeam.z+.5);float te=(uQT-uLock[k]-aWSeam.w)/.18;
    if(te<=0.){hide=true;p=vec3(0.);h=0.;a=0.;}
    else if(te>=1.)wst(1,p,h,a);
    else{wst(0,p0,h0,a0);wst(1,p1,h1,a1);
      if(uReduced>.5){p=te<.5?p0:p1;h=te<.5?h0:h1;a=te<.5?0.:a1*(2.*te-1.);}
      else{float t=easeIO(te);p=bez(p0,(p0+p1)*.5+aWDir.xyz*length(p1-p0)*.18,p1,t);h=mix(h0,h1,t);a=mix(.95,a1,t)*(1.-t*.35);}}
  }else{
    int f=int(uF+.5),tt=int(uT+.5);
    if(f==tt){wst(f,p,h,a);cw=f>=3?1.:0.;ori=f==3?1.:0.;}
    else{wst(f,p0,h0,a0);wst(tt,p1,h1,a1);
      if(uReduced>.5){bool b=uG>=.5;p=b?p1:p0;h=b?h1:h0;a=(b?a1:a0)*abs(2.*uG-1.);int s=b?tt:f;cw=s>=3?1.:0.;ori=s==3?1.:0.;}
      else{float d=f==2?aWDelay.x:(f>=3?aWDelay.y:aWX.x*.4);
        float t=easeF(clamp((uG-d*uSpread)/(1.-uSpread),0.,1.));
        float dist=length(p1-p0)*.35;p=bez(p0,(p0+p1)*.5+aWDir.xyz*dist,p1,t);
        h=mix(h0,h1,t);a=mix(a0,a1,t);cw=mix(f>=3?1.:0.,tt>=3?1.:0.,t);ori=mix(f==3?1.:0.,tt==3?1.:0.,t);}}
  }
  vec3 o=proj(p);float hp=h*o.z;
  vec2 cr=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*2.-1.;
  vUV=mix(aWUV.xy,aWUV.zw,cr*.5+.5);
  if(hide||o.z<0.||a<.01||hp<2.5||hp>150.){gl_Position=vec4(2.,2.,2.,1.);vA=0.;vCol=vec3(0.);return;}
  float z2=uFocal/o.z;if(z2<290.)a*=clamp((z2-30.)/260.,0.,1.);
  a*=clamp((150.-hp)/70.,0.,1.);
  float ang=0.;
  if(ori>.01){vec3 o2=proj(p+aWTan.xyz*20.);if(o2.z>0.){vec2 dd=o2.xy-o.xy;float a2=atan(dd.y,dd.x);if(a2>1.5708)a2-=3.14159;else if(a2<-1.5708)a2+=3.14159;ang=a2*ori;}}
  float qh=hp*1.3333;vec2 v=vec2(cr.x*aWX.y*qh*.5,cr.y*qh*.5);
  float cs=cos(ang),sn=sin(ang);v=vec2(v.x*cs-v.y*sn,v.x*sn+v.y*cs);
  gl_Position=clipPos(o.xy+v);
  vec3 sourceColor=aWCol.w<1.5?(aWCol.w<.5?WARM_S:COOL_S):vec3(236.,231.,223.)/255.;
  vCol=mix(sourceColor,aWCol.rgb,cw);vA=a*.88;
}`;
export const VS_OCC=VS_COMMON+`
in vec3 aPos;
void main(){vec3 d=uRot*(aPos-uCamPos);
  gl_Position=vec4((2.*uCenter.x/uRes.x-1.)*d.z+2.*uFocal/uRes.x*d.x,(1.-2.*uCenter.y/uRes.y)*d.z-2.*uFocal/uRes.y*d.y,1.0010005*d.z-60.03,d.z);}`;
export const FS_OCC=`#version 300 es
precision mediump float;uniform float uOccA;out vec4 o;void main(){o=vec4(0.,0.,0.,uOccA);}`;
export const FS_WORDS=`#version 300 es
precision mediump float;
uniform sampler2D uTex;in vec2 vUV;in vec3 vCol;in float vA;out vec4 o;
void main(){float t=texture(uTex,vUV).a*vA;o=vec4(vCol*t,t);}`;

export const L_PART=[['aDust',3],['aScene',4],['aColR',3],['aColS',3],['aDir',3],['aR',4],['aV',3],['aMD',2],['aPhase',1],['aCh',1]];

export const L_WORD=[['aWSeam',4],['aWDir',4],['aWScene',4],['aWTan',4],['aWCol',4],['aWHeight',1],['aWDelay',2],['aWX',2],['aWUV',4]];
