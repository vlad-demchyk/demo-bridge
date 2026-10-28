import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function fontTable(bytes,name){
  for(let i=0;i<bytes.readUInt16BE(4);i++){
    const p=12+i*16;
    if(bytes.toString('ascii',p,p+4)===name)return bytes.readUInt32BE(p+8);
  }
  throw new Error('Missing font table: '+name);
}
function hasGlyph(bytes,code){
  const cmap=fontTable(bytes,'cmap');
  for(let i=0;i<bytes.readUInt16BE(cmap+2);i++){
    const rec=cmap+4+i*8,platform=bytes.readUInt16BE(rec),encoding=bytes.readUInt16BE(rec+2);
    if(platform!==0&&!(platform===3&&(encoding===1||encoding===10)))continue;
    const table=cmap+bytes.readUInt32BE(rec+4),format=bytes.readUInt16BE(table);
    if(format===12){
      for(let j=0;j<bytes.readUInt32BE(table+12);j++){
        const p=table+16+j*12,start=bytes.readUInt32BE(p),end=bytes.readUInt32BE(p+4);
        if(code>=start&&code<=end&&bytes.readUInt32BE(p+8)+code-start!==0)return true;
      }
    }
    if(format===4&&code<=65535){
      const n=bytes.readUInt16BE(table+6)/2,ends=table+14,starts=ends+n*2+2,deltas=starts+n*2,ranges=deltas+n*2;
      for(let j=0;j<n;j++){
        const end=bytes.readUInt16BE(ends+j*2),start=bytes.readUInt16BE(starts+j*2);
        if(code<start||code>end)continue;
        const delta=bytes.readInt16BE(deltas+j*2),range=bytes.readUInt16BE(ranges+j*2);
        let glyph=range?bytes.readUInt16BE(ranges+j*2+range+(code-start)*2):(code+delta)&65535;
        if(range&&glyph)glyph=(glyph+delta)&65535;
        if(glyph)return true;
      }
    }
  }
  return false;
}
const load=name=>readFileSync(new URL('../public/fonts/'+name,import.meta.url));
test('both text fonts contain every Ukrainian letter, including Ґ Є І Ї',()=>{
  const alphabet='АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  for(const name of ['NotoSans-SemiCondensed-500.ttf','MartianMono-Regular.ttf']){
    const font=load(name);
    for(const ch of alphabet)assert.ok(hasGlyph(font,ch.codePointAt(0)),name+' lacks '+ch);
  }
});
test('the bundled Noto face is medium 500 and SemiCondensed width class 4',()=>{
  const font=load('NotoSans-SemiCondensed-500.ttf'),os2=fontTable(font,'OS/2');
  assert.equal(font.readUInt16BE(os2+4),500);
  assert.equal(font.readUInt16BE(os2+6),4);
});