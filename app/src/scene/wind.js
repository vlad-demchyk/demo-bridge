import {clamp} from './math.js';

// Match the same transition windows used by VS_PARTICLE, independent of scroll speed.
export function sceneWindIntensity(mode,phase,qT=0,locks=[],flightSpeed=0){
  const flight=t=>t>0&&t<1?Math.sin(Math.PI*t):0;
  const speed=1-Math.exp(-Math.abs(flightSpeed)*4);
  if(mode==='Q')return speed*Math.min(1,locks.reduce((sum,lock)=>sum+flight((qT-lock)/.15),0)*.85);
  if(mode==='F')return speed*Math.max(.65*flight((phase-.05)/.025),flight((phase-.08)/.14));
  return 0;
}

export function sceneExplosionIntensity(phase,flightSpeed=0){
  const t=(phase-.08)/.14;
  if(t<=0||t>=1)return 0;
  const envelope=(1-Math.exp(-t*32))*Math.exp(-t*3.8);
  return clamp(envelope*1.5)*(1-Math.exp(-Math.abs(flightSpeed)*4));
}

// Filtered stereo noise; no recorded wind asset or continuous JS audio loop.
export function createSpaceWind(){
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return null;
  const context=new Context(),buffer=context.createBuffer(2,Math.ceil(context.sampleRate*3),context.sampleRate);
  for(let channel=0;channel<2;channel++){
    const samples=buffer.getChannelData(channel);let brown=0;
    for(let i=0;i<samples.length;i++){brown=.985*brown+.09*(Math.random()*2-1);samples[i]=brown;}
  }
  const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const band=context.createBiquadFilter();band.type='bandpass';band.frequency.value=420;band.Q.value=.55;
  const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=1050;
  const gain=context.createGain();gain.gain.value=0;
  noise.connect(band);band.connect(low);low.connect(gain);gain.connect(context.destination);noise.start();
  const burstLow=context.createBiquadFilter();burstLow.type='lowpass';burstLow.frequency.value=350;
  const burstGain=context.createGain();burstGain.gain.value=0;
  const burstBus=context.createDynamicsCompressor();
  burstBus.threshold.value=-28;burstBus.knee.value=18;burstBus.ratio.value=2.5;
  burstBus.attack.value=.015;burstBus.release.value=.4;
  burstBus.connect(context.destination);
  noise.connect(burstLow);burstLow.connect(burstGain);burstGain.connect(burstBus);
  const sub=context.createOscillator();sub.type='sine';sub.frequency.value=32;
  const subGain=context.createGain();subGain.gain.value=0;sub.connect(subGain);subGain.connect(burstBus);sub.start();
  const overtone=context.createOscillator();overtone.type='sine';overtone.frequency.value=64;
  const overtoneGain=context.createGain();overtoneGain.gain.value=0;
  overtone.connect(overtoneGain);overtoneGain.connect(burstBus);overtone.start();
  let last=-1,lastBurst=-1,closed=false,muted=false;
  return{
    setIntensity(value){
      if(closed)return;
      const level=muted?0:clamp(value);if(Math.abs(level-last)<.002)return;last=level;
      const now=context.currentTime;
      gain.gain.setTargetAtTime(level*.030,now,level>gain.gain.value/.030?.28:.5);
      band.frequency.setTargetAtTime(180+level*650,now,.35);
    },
    setBurst(value){
      if(closed)return;
      const level=muted?0:clamp(value);if(Math.abs(level-lastBurst)<.002)return;lastBurst=level;
      const now=context.currentTime,tc=level>burstGain.gain.value/.085?.09:.4;
      burstGain.gain.setTargetAtTime(level*.085,now,tc);
      subGain.gain.setTargetAtTime(level*.026,now,tc);
      const frequency=27+level*13;
      sub.frequency.setTargetAtTime(frequency,now,.18);
      overtoneGain.gain.setTargetAtTime(level*.008,now,tc);
      overtone.frequency.setTargetAtTime(frequency*2,now,.18);
    },
    setMuted(value){muted=value;last=-1;lastBurst=-1;if(value){for(const node of [gain,burstGain,subGain,overtoneGain]){node.gain.cancelScheduledValues(context.currentTime);node.gain.setValueAtTime(0,context.currentTime);}}},
    resume(){if(!closed&&context.state==='suspended')context.resume().catch(()=>{});},
    suspend(){if(!closed)context.suspend().catch(()=>{});},
    destroy(){closed=true;noise.stop();sub.stop();overtone.stop();overtone.disconnect();overtoneGain.disconnect();burstBus.disconnect();sub.disconnect();subGain.disconnect();burstLow.disconnect();burstGain.disconnect();noise.disconnect();band.disconnect();low.disconnect();gain.disconnect();context.close().catch(()=>{});}
  };
}
