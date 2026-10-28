import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_HANDOFF_START,WORLD_FORMED_PROGRESS,SCENE_NAV_END,FIRST_CARD_START,SCENE_EXIT_HOLD,sceneTravel,sceneHandoff,finaleProgress,finaleScrollProgress,checkpointTimeline,meterProgress,bridgeMeterGeometry,pairPlaybackRate,sceneFinaleProgress,sceneFinaleScrollProgress} from '../src/scene/progress.js';
import {WARM,SCENE_WARM,COOL} from '../src/scene/math.js';

test('checkpoint list includes all pairs and a final destination after the burst',()=>{
  const bounds=[{top:1000,height:1800},{top:2800,height:1800},{top:4600,height:1800}];
  const stops=checkpointTimeline(bounds,6400,6300,900);
  assert.equal(stops.length,4);assert.equal(stops[0],1666);
  assert.ok(stops.every((v,i)=>!i||v>stops[i-1]));
  assert.ok(Math.abs(sceneFinaleProgress((stops[3]-6400)/6300)-SCENE_HANDOFF_START)<1e-12);
  assert.ok(SCENE_HANDOFF_START>.08);
  assert.ok(SCENE_HANDOFF_START<WORLD_FORMED_PROGRESS);
});
test('finale phase mapping and inverse agree across the entire timeline',()=>{
  for(let i=0;i<=100;i++)assert.ok(Math.abs(finaleProgress(finaleScrollProgress(i/100))-i/100)<1e-12);
});
test('overall progress crosses checkpoints continuously without restarting each segment',()=>{
  const stops=[100,200,300,400];
  assert.equal(meterProgress(0,0,stops),0);assert.equal(meterProgress(100,0,stops),.25);
  assert.equal(meterProgress(150,0,stops),.375);assert.equal(meterProgress(400,0,stops),1);
  assert.equal(meterProgress(800,0,stops),1);assert.equal(meterProgress(-100,0,stops),0);
});
test('bridge meter morphs into one central arch above a wide curved deck',()=>{
  const flat=bridgeMeterGeometry(0),bridge=bridgeMeterGeometry(1);
  for(const u of [0,.25,.5,.75,1]){assert.equal(flat.yAt(u),34);assert.equal(flat.deckAt(u),34);}
  assert.equal(bridge.yAt(.5),2);assert.equal(bridge.deckAt(.5),15);
  assert.equal(bridge.yAt(0),34);assert.equal(bridge.yAt(1),34);
  assert.equal(bridge.yAt(.1),bridge.deckAt(.1));
  for(let i=0;i<=100;i++)assert.ok(bridge.yAt(i/100)<=bridge.deckAt(i/100));
  assert.ok(bridgeMeterGeometry(.5).yAt(.5)>2);
});

test('semantic animation palette matches the requested endpoint colors',()=>{
  assert.deepEqual(WARM,[255,125,64]);assert.deepEqual(COOL,[100,213,255]);assert.deepEqual(SCENE_WARM,[255,64,31]);
});
test('approach to the burst uses 40 percent less scroll while preserving phase anchors',()=>{
  const oldDistance=.08*(.78/.72);
  assert.ok(Math.abs(finaleScrollProgress(.08)/oldDistance-.6)<1e-12);
  assert.equal(finaleProgress(.78),.72);assert.equal(finaleProgress(1),1);
});
test('autoplay slows phrase exits and returns to normal speed outside the transition',()=>{
  const bounds=[{top:1000,height:2400}];
  assert.equal(pairPlaybackRate(0,bounds,1000),1);
  assert.equal(pairPlaybackRate(1000+.8*1400,bounds,1000),.65);
  assert.equal(pairPlaybackRate(2500,bounds,1000),1);
});

test('the animated timeline reaches the final hero before its short release hold',()=>{
  assert.ok(Math.abs(sceneFinaleProgress(1)-.84)<1e-12);
  assert.ok(Math.abs(sceneFinaleScrollProgress(.84)-1)<1e-12);
  for(const p of [0,.075,.08,.22,.5,.72,.84])assert.ok(Math.abs(sceneFinaleProgress(sceneFinaleScrollProgress(p))-p)<1e-12);
});

test('navigation fades before the first card and the card is ready when the world forms',()=>{
  assert.deepEqual(sceneHandoff(SCENE_HANDOFF_START),{navigation:1,card:0});
  assert.deepEqual(sceneHandoff(SCENE_NAV_END),{navigation:0,card:0});
  assert.deepEqual(sceneHandoff(FIRST_CARD_START),{navigation:0,card:0});
  assert.deepEqual(sceneHandoff(WORLD_FORMED_PROGRESS),{navigation:0,card:1});
  assert.ok(SCENE_NAV_END<FIRST_CARD_START);
  assert.ok(sceneHandoff(.155).navigation>.1&&sceneHandoff(.155).navigation<.9);
});

test('one short scroll step holds the final frame without stretching the animated timeline',()=>{
  assert.equal(SCENE_EXIT_HOLD,120);
  assert.equal(sceneTravel(7120+SCENE_EXIT_HOLD,1000),6120);
  assert.equal(sceneTravel(100,1000),1);
});
