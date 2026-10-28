import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneAudioGain,nextAudioVolume} from '../src/scene/audio.js';
import {sceneWindIntensity,sceneExplosionIntensity} from '../src/scene/wind.js';

test('music stays at its base level until the final hero and fades early to silence at the final hero',()=>{
  assert.equal(sceneAudioGain('H',0),1);assert.equal(sceneAudioGain('Q',1),1);
  assert.equal(sceneAudioGain('F',.46),1);
  assert.ok(Math.abs(sceneAudioGain('F',.70))<1e-12);
  assert.ok(Math.abs(sceneAudioGain('F',1)*.1)<1e-12);
  let last=1;
  for(let i=0;i<=100;i++){
    const v=sceneAudioGain('F',i/100);
    assert.ok(v<=last&&v>=0);last=v;
  }
  // Returning to the same phase restores exactly the same target volume.
  assert.equal(sceneAudioGain('F',.4),1);
});

test('wind follows particle flight windows rather than wheel speed',()=>{
  assert.equal(sceneWindIntensity('H',0),0);
  assert.equal(sceneWindIntensity('Q',0,.2,[.5]),0);
  assert.ok(sceneWindIntensity('Q',0,.575,[.5],2)>.8);
  assert.equal(sceneWindIntensity('Q',0,.8,[.5]),0);
  assert.ok(sceneWindIntensity('F',.15,0,[],2)>0);
  assert.equal(sceneWindIntensity('F',.3),0);
  assert.equal(sceneWindIntensity('Q',0,.575,[.5],0),0);
  assert.ok(sceneWindIntensity('Q',0,.575,[.5],2)>sceneWindIntensity('Q',0,.575,[.5],.1));
});

test('audio ramp tolerates the first RAF timestamp preceding its start time',()=>{
  assert.equal(nextAudioVolume(0,.08,-.01),0);
  const first=nextAudioVolume(0,.08,.016);
  assert.ok(first>0&&first<.08);
  assert.ok(nextAudioVolume(1,0,.1)>=0);
  assert.ok(nextAudioVolume(0,4,1)<=1);
});

test('the synthesized burst follows the explosion and fades when scene motion stops',()=>{
  assert.equal(sceneExplosionIntensity(.07,2),0);
  assert.ok(sceneExplosionIntensity(.10,2)>.5);
  assert.equal(sceneExplosionIntensity(.10,0),0);
  assert.equal(sceneExplosionIntensity(.23,2),0);
  assert.ok(sceneExplosionIntensity(.10,2)>sceneExplosionIntensity(.10,.1));
});
