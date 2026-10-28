import test from 'node:test';
import assert from 'node:assert/strict';
import {disposeResources,compile,strideOf} from '../src/scene/gl.js';
import {L_PART,L_WORD} from '../src/scene/shaders.js';

function recorder(){
  const deleted={buffers:[],vaos:[],textures:[]};
  return {deleted,gl:{deleteBuffer:b=>deleted.buffers.push(b),deleteVertexArray:v=>deleted.vaos.push(v),deleteTexture:t=>deleted.textures.push(t)}};
}
test('rebuild releases every mesh while retaining shared atlas textures',()=>{
  const {gl,deleted}=recorder(),atlas={},image={},mesh={b:{},v:{}};
  disposeResources(gl,{pts:mesh,img:{b:{},v:{}},alias:mesh,texG:atlas,texF:image},new Set([atlas]));
  assert.equal(deleted.buffers.length,2);assert.equal(deleted.vaos.length,2);
  assert.deepEqual(deleted.textures,[image]);
  disposeResources(gl,{pts:{b:{},v:{}},texG:atlas});
  assert.equal(deleted.buffers.length,3);assert.equal(deleted.vaos.length,3);
  assert.deepEqual(deleted.textures,[image,atlas]);
});
test('cleanup accepts absent resources and aliased textures',()=>{
  const {gl,deleted}=recorder(),texture={};
  disposeResources(gl,null);disposeResources(gl,{texW:texture,texG:texture,img:null});
  assert.deepEqual(deleted.textures,[texture]);
});
test('linked shader objects are detached and released',()=>{
  const deleted=[],detached=[],program={};
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ACTIVE_UNIFORMS:5,
    createShader:type=>({type}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
    createProgram:()=>program,attachShader(){},linkProgram(){},getProgramParameter:(_,kind)=>kind===5?0:true,
    detachShader:(_,shader)=>detached.push(shader),deleteShader:shader=>deleted.push(shader)};
  assert.equal(compile(gl,'vertex','fragment').p,program);
  assert.equal(deleted.length,2);assert.deepEqual(detached,deleted);
});
test('particle and word buffers retain the compact scene layouts',()=>{
  assert.equal(strideOf(L_PART),27);assert.equal(strideOf(L_WORD),29);
});