import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneViewport,filmReveal} from '../src/scene/viewport.js';

test('scene frame covers the whole viewport independently of cinema bars',()=>{
  for(const [w,h] of [[1920,900],[1200,900],[390,844],[2560,1080]]){
    const layout=sceneViewport(w,h);
    assert.deepEqual(layout.frame,{x:0,y:0,w,h});
    assert.ok(layout.cover.ix0<=0&&layout.cover.iy0<=0);
    assert.ok(layout.cover.ix0+layout.cover.dw>=w);
    assert.ok(layout.cover.iy0+layout.cover.dh>=h);
  }
});
test('portrait layouts have no cinema bands, widescreen retains independent bands',()=>{
  assert.deepEqual(sceneViewport(390,844).bars,{top:0,bottom:0});
  const {bars}=sceneViewport(1920,900);
  assert.ok(bars.top>0&&bars.bottom>0);
  assert.ok(Math.abs(bars.top-bars.bottom)<=1);
});
test('cinema bands reveal the canvas continuously and reverse with scroll',()=>{
  assert.equal(filmReveal(0),0);assert.equal(filmReveal(.7),0);
  assert.equal(filmReveal(.84),1);assert.equal(filmReveal(1),1);
  let previous=0;
  for(let i=0;i<=100;i++){
    const value=filmReveal(.7+i*.0014);
    assert.ok(value>=previous&&value<=1);previous=value;
  }
  assert.ok(Math.abs(filmReveal(.77)-.5)<1e-12);
});