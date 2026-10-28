/* Thin WebGL2 helpers. Each takes the context explicitly. */
export function compile(gl,vs,fs){
  const mk=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram(),v=mk(gl.VERTEX_SHADER,vs),f=mk(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  gl.detachShader(p,v);gl.detachShader(p,f);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(p));
  const U={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);const name=info.name.replace(/\[0\]$/,'');U[name]=gl.getUniformLocation(p,info.name);}
  return{p,U};
}
export const strideOf=l=>l.reduce((s,x)=>s+x[1],0);
export function makeVAO(gl,prog,data,layout,divisor){
  const v=gl.createVertexArray();gl.bindVertexArray(v);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  const stride=strideOf(layout)*4;let off=0;
  for(const [name,size] of layout){const loc=gl.getAttribLocation(prog,name);
    if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,off);gl.vertexAttribDivisor(loc,divisor);}
    off+=size*4;}
  gl.bindVertexArray(null);return{v,b};
}
export function makeTex(gl,canvas,mip){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  if(mip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return t;
}

/** Release owned GPU objects, retaining only explicitly shared textures. */
export function disposeResources(gl,resources,keepTextures=new Set()){
  if(!resources)return;
  const buffers=new Set(),vaos=new Set(),textures=new Set();
  for(const value of Object.values(resources))if(value?.b&&value?.v){buffers.add(value.b);vaos.add(value.v);}
  for(const [key,value] of Object.entries(resources))if(key.startsWith('tex')&&value&&!keepTextures.has(value))textures.add(value);
  buffers.forEach(b=>gl.deleteBuffer(b));vaos.forEach(v=>gl.deleteVertexArray(v));textures.forEach(t=>gl.deleteTexture(t));
}