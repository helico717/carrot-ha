// Part of the optional 3D vehicle model pipeline (see docs/VEHICLE_3D_MODEL.md).
// Input and output files live in the folder named by MODEL_WORK (default ./work); none are committed.
const WORK=process.env.MODEL_WORK||'./work';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,KHRMaterialsEmissiveStrength} from '@gltf-transform/extensions';
import {prune,dedup,weld,quantize,meshopt,reorder} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import * as THREE from 'three';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const uvW=parseFloat(process.argv[4]||'8');
const ratio=parseFloat(process.argv[2]||'0.3'), err=parseFloat(process.argv[3]||'0.01');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(`${WORK}/source.glb`);
const root=doc.getRoot();
for(const n of root.listNodes()){ if(/^INT_AIRBAGS|^INT_CUPHOLDER/.test(n.getName())) n.dispose(); }
for(const a of root.listAnimations()){ if(/Airbags|Cupholder|Open all doors/.test(a.getName())) a.dispose(); }

// ---- tail light bar transplant from the second model (CC BY-NC 4.0, BloxBloger) ----
{
  const d2=await io.read(`${WORK}/second.glb`);
  const barNode=d2.getRoot().listNodes().find(n=>n.getMesh()&&n.getMesh().listPrimitives().some(p=>/Red_Light22/.test(p.getMaterial()?.getName()||'')));
  const prim=barNode.getMesh().listPrimitives()[0];
  const W2=new THREE.Matrix4().fromArray(barNode.getWorldMatrix());
  const S=0.1006, XC=-0.2525, REAR2=-24.359, REAR1=2.357;
  const posA=prim.getAttribute('POSITION'), norA=prim.getAttribute('NORMAL'), idxA=prim.getIndices();
  const n=posA.getCount();
  const P=new Float32Array(n*3), N=new Float32Array(n*3);
  const v=new THREE.Vector3(), t=[0,0,0];
  const nm=new THREE.Matrix3().getNormalMatrix(W2);
  for(let i=0;i<n;i++){
    posA.getElement(i,t); v.set(...t).applyMatrix4(W2);
    P.set([-(v.x-XC)*S,(v.y-0.02)*S,REAR1-(v.z-REAR2)*S],i*3);
    if(norA){norA.getElement(i,t); v.set(...t).applyMatrix3(nm).normalize(); N.set([-v.x,v.y,-v.z],i*3);}
  }
  const idx=idxA.getArray();
  const centre=[],side=[];
  for(let i=0;i<idx.length;i+=3){
    const cx=(P[idx[i]*3]+P[idx[i+1]*3]+P[idx[i+2]*3])/3;
    (Math.abs(cx)<0.625?centre:side).push(idx[i],idx[i+1],idx[i+2]);
  }
  console.log('bar tris centre',centre.length/3,'side',side.length/3);
  const mat=doc.createMaterial('Glow_Red_Bar').setBaseColorFactor([0.12,0.0,0.0,1]).setEmissiveFactor([1,0.02,0.02]).setRoughnessFactor(0.4).setMetallicFactor(0);
  const ext=doc.createExtension(KHRMaterialsEmissiveStrength);
  mat.setExtension('KHR_materials_emissive_strength', ext.createEmissiveStrength().setEmissiveStrength(4));
  const buf=doc.getRoot().listBuffers()[0];
  const make=(name,indices,toLocal)=>{
    const pos=new Float32Array(P), nor=new Float32Array(N);
    if(toLocal){const inv=toLocal, nmat=new THREE.Matrix3().getNormalMatrix(inv);
      for(let i=0;i<n;i++){v.fromArray(P,i*3).applyMatrix4(inv).toArray(pos,i*3); v.fromArray(N,i*3).applyMatrix3(nmat).normalize().toArray(nor,i*3);}}
    const pr=doc.createPrimitive()
      .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buf))
      .setMaterial(mat);
    return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(pr));
  };
  const nodes=root.listNodes();
  const lid=nodes.find(x=>x.getName().startsWith('EXT_TRUNK_LID_'));
  const lidInv=new THREE.Matrix4().fromArray(lid.getWorldMatrix()).invert();
  lid.addChild(make('Tail_Bar_Centre',centre,lidInv));
  doc.getRoot().listScenes()[0].addChild(make('Tail_Bar_Sides',side,null));
  for(const x of nodes){ if(/^Ext_Taillight#Glow_Red|^Ext_Trunk_Lid_Taillight#Glow_Red/.test(x.getName())) x.dispose(); }

  // ---- lamp housing, reflectors and lens from model 2 (triangles inside the lamp zone) ----
  const MATS={
    toyo: doc.createMaterial('Tail_Housing_Dark').setBaseColorFactor([0.02,0.02,0.022,1]).setRoughnessFactor(0.5).setMetallicFactor(0.15),
    chrome: doc.createMaterial('Tail_Chrome').setBaseColorFactor([0.42,0.43,0.45,1]).setRoughnessFactor(0.35).setMetallicFactor(0.5),
    Glass: doc.createMaterial('Tail_Lens').setBaseColorFactor([0.03,0.03,0.035,0.4]).setRoughnessFactor(0.08).setMetallicFactor(0).setAlphaMode('BLEND'),
  };
  const ZONE={x:[-8.9,8.4],y:[9.7,11.45],z:[-24.5,-20.5]};
  const groups={};
  for(const nd of d2.getRoot().listNodes()){
    const mesh=nd.getMesh(); if(!mesh) continue;
    const W=new THREE.Matrix4().fromArray(nd.getWorldMatrix()); const nmx=new THREE.Matrix3().getNormalMatrix(W);
    for(const pr of mesh.listPrimitives()){
      const key=pr.getMaterial().getName(); if(!MATS[key]) continue;
      const pa=pr.getAttribute('POSITION'), na=pr.getAttribute('NORMAL'), ia=pr.getIndices();
      const map=new Map(), outP=[], outN=[], outI=[];
      const tmp=[0,0,0], vv=new THREE.Vector3();
      const get=(vi)=>{ if(map.has(vi)) return map.get(vi);
        pa.getElement(vi,tmp); vv.set(...tmp).applyMatrix4(W);
        const px=-(vv.x-XC)*S, py=(vv.y-0.02)*S, pz=REAR1-(vv.z-REAR2)*S;
        let nx=0,ny=0,nz=1; if(na){na.getElement(vi,tmp); vv.set(...tmp).applyMatrix3(nmx).normalize(); nx=-vv.x;ny=vv.y;nz=-vv.z}
        const id=outP.length/3; outP.push(px,py,pz); outN.push(nx,ny,nz); map.set(vi,id); return id; };
      const tri=[0,0,0], c=new THREE.Vector3();
      for(let i=0;i<ia.getCount();i+=3){
        c.set(0,0,0);
        for(let k=0;k<3;k++){pa.getElement(ia.getScalar(i+k),tmp); vv.set(...tmp).applyMatrix4(W); c.add(vv)}
        c.divideScalar(3);
        if(c.x<ZONE.x[0]||c.x>ZONE.x[1]||c.y<ZONE.y[0]||c.y>ZONE.y[1]||c.z<ZONE.z[0]||c.z>ZONE.z[1]) continue;
        for(let k=0;k<3;k++) tri[k]=get(ia.getScalar(i+k));
        outI.push(tri[0],tri[1],tri[2]);
      }
      if(!outI.length) continue;
      (groups[key]??=[]).push({P:outP,N:outN,I:outI});
    }
  }
  // merge groups per material and split centre/side
  const buf2=doc.getRoot().listBuffers()[0];
  const addPart=(name,mat,parts,toLocal,parent)=>{
    const P=[],N=[],I=[]; let base=0;
    for(const g of parts){ for(const i of g.I) I.push(i+base); P.push(...g.P); N.push(...g.N); base+=g.P.length/3; }
    if(!I.length) return;
    const pos=new Float32Array(P), nor=new Float32Array(N);
    if(toLocal){const nmat=new THREE.Matrix3().getNormalMatrix(toLocal); const q=new THREE.Vector3();
      for(let i=0;i<pos.length/3;i++){q.fromArray(pos,i*3).applyMatrix4(toLocal).toArray(pos,i*3); q.fromArray(nor,i*3).applyMatrix3(nmat).normalize().toArray(nor,i*3);}}
    const pr=doc.createPrimitive()
      .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf2))
      .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf2))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf2))
      .setMaterial(mat);
    parent.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(pr)));
  };
  const scene0=doc.getRoot().listScenes()[0];
  const sceneHolder={addChild:(n)=>scene0.addChild(n)};
  let total=0;
  for(const [key,list] of Object.entries(groups)){
    const centreParts=[],sideParts=[];
    for(const g of list){
      const cI=[],sI=[];
      for(let i=0;i<g.I.length;i+=3){const cx=(g.P[g.I[i]*3]+g.P[g.I[i+1]*3]+g.P[g.I[i+2]*3])/3; (Math.abs(cx)<0.625?cI:sI).push(g.I[i],g.I[i+1],g.I[i+2]);}
      centreParts.push({P:g.P,N:g.N,I:cI}); sideParts.push({P:g.P,N:g.N,I:sI}); total+=g.I.length/3;
    }
    addPart('Tail_'+key+'_Centre',MATS[key],centreParts,lidInv,lid);
    addPart('Tail_'+key+'_Sides',MATS[key],sideParts,null,sceneHolder);
  }
  console.log('housing tris',total);
  for(const x of nodes){ if(/^Ext_Taillight|^Ext_Trunk_Lid_Taillight/.test(x.getName())) x.dispose(); }
}

// ---- Meshy wheel replaces the four rims ----
if(process.env.WHEEL!=='0'){
  const fs=await import('fs');
  const wd=await io.read(`${WORK}/wheel_clean_raw.glb`);
  const wp=wd.getRoot().listNodes().find(n=>n.getMesh()).getMesh().listPrimitives()[0];
  const WP=wp.getAttribute('POSITION').getArray(), WN=wp.getAttribute('NORMAL').getArray(), WI=wp.getIndices().getArray();
  const ROT=(parseFloat(process.env.WHEEL_ROT||'0'))*Math.PI/180, FLIP=process.env.WHEEL_FLIP==='1';
  // Fit the wheel to the tyre: flatten the relief along the axle so the spokes do not stand proud
  // of the tyre sidewall. The outer lip stays at the top plane, so it still covers the tyre bead.
  const FLAT=parseFloat(process.env.WHEEL_FLAT||'0.4');
  let zTop=-1e9; for(let i=2;i<WP.length;i+=3) zTop=Math.max(zTop,WP[i]);
  for(let i=2;i<WP.length;i+=3) WP[i]=zTop-(zTop-WP[i])*FLAT;
  const vc=WP.length/3, uv=new Float32Array(vc*2);
  for(let i=0;i<vc;i++){
    let x=WP[i*3], y=WP[i*3+1]; if(FLIP) x=-x;
    const rx=x*Math.cos(ROT)-y*Math.sin(ROT), ry=x*Math.sin(ROT)+y*Math.cos(ROT);
    uv[i*2]=0.5+rx*0.985; uv[i*2+1]=0.5-ry*0.985;
  }
  const faceI=[],darkI=[];
  for(let i=0;i<WI.length;i+=3){
    const nz=(WN[WI[i]*3+2]+WN[WI[i+1]*3+2]+WN[WI[i+2]*3+2])/3;
    (nz>0.35?faceI:darkI).push(WI[i],WI[i+1],WI[i+2]);
  }
  const tex=doc.createTexture('wheel_photo').setImage(new Uint8Array(fs.readFileSync(`${WORK}/wheel_photo.png`))).setMimeType('image/png');
  const faceMat=doc.createMaterial('Wheel_Face').setBaseColorTexture(tex).setMetallicFactor(0.45).setRoughnessFactor(0.4);
  const darkMat=doc.createMaterial('Wheel_Dark').setBaseColorFactor([0.1,0.1,0.11,1]).setMetallicFactor(0.6).setRoughnessFactor(0.4);
  const bufw=doc.getRoot().listBuffers()[0];
  const posAcc=doc.createAccessor().setType('VEC3').setArray(new Float32Array(WP)).setBuffer(bufw);
  const norAcc=doc.createAccessor().setType('VEC3').setArray(new Float32Array(WN)).setBuffer(bufw);
  const uvAcc=doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(bufw);
  const mk=(I,mat,withUv)=>{const pr=doc.createPrimitive().setAttribute('POSITION',posAcc).setAttribute('NORMAL',norAcc).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(bufw)).setMaterial(mat); if(withUv) pr.setAttribute('TEXCOORD_0',uvAcc); return pr;};
  const wheelMesh=doc.createMesh('Meshy_Wheel').addPrimitive(mk(faceI,faceMat,true)).addPrimitive(mk(darkI,darkMat,true));
  // Flat centre cap carrying the VW logo from the photo (no relief needed there).
  {
    let hubZ=-1e9; for(let i=0;i<vc;i++){ if(Math.hypot(WP[i*3],WP[i*3+1])<0.07) hubZ=Math.max(hubZ,WP[i*3+2]); }
    const R=parseFloat(process.env.CAP_R||'0.066'), SEG=48, z=hubZ+0.002;
    const cp=[0,0,z], cn=[0,0,1], cu=[0.5,0.5], ci=[];
    for(let k=0;k<=SEG;k++){ const a=k/SEG*Math.PI*2, x=Math.cos(a)*R, y=Math.sin(a)*R; cp.push(x,y,z); cn.push(0,0,1);
      const rx=x*Math.cos(ROT)-y*Math.sin(ROT), ry=x*Math.sin(ROT)+y*Math.cos(ROT); cu.push(0.5+(FLIP?-rx:rx)*0.985,0.5-ry*0.985);
      if(k>0) ci.push(0,k,k+1); }
    const capPrim=doc.createPrimitive()
      .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(cp)).setBuffer(bufw))
      .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(cn)).setBuffer(bufw))
      .setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(cu)).setBuffer(bufw))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ci)).setBuffer(bufw))
      .setMaterial(faceMat);
    wheelMesh.addPrimitive(capPrim);
    console.log('hub front z',hubZ.toFixed(3),'cap tris',ci.length/3);
  }
  // Dark drum that closes the hollow tyre: open cylinder just inside the tyre bead plus a back cap,
  // so nothing can be seen through the tyre from any angle. Dimensions come from measuring the tyre
  // (bead radius 0.257 m, tyre spans 0.113 m outward / 0.129 m inward of the wheel centre plane).
  const DRUM_R=parseFloat(process.env.DRUM_R||'0.272'), DRUM_IN=parseFloat(process.env.DRUM_IN||'0.125'), DRUM_OUT=parseFloat(process.env.DRUM_OUT||'0.113');
  const drumMat=doc.createMaterial('Tyre_Inner').setBaseColorFactor([0.015,0.015,0.017,1]).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(true);
  const buildDrum=(dm)=>{ // dm = wheel scale; geometry in the same normalised units as the wheel
    const R=DRUM_R/dm, z0=zTop-(0.113-DRUM_OUT)/dm, z1=zTop-(0.113+DRUM_IN)/dm, SEG=64;
    const P=[],N=[],I=[];
    for(let k=0;k<=SEG;k++){const a=k/SEG*Math.PI*2,c=Math.cos(a),sn=Math.sin(a); P.push(c*R,sn*R,z0, c*R,sn*R,z1); N.push(-c,-sn,0,-c,-sn,0);}
    for(let k=0;k<SEG;k++){const a=k*2; I.push(a,a+1,a+2, a+1,a+3,a+2);}
    const base=P.length/3; P.push(0,0,z1); N.push(0,0,1); for(let k=0;k<=SEG;k++){const a=k/SEG*Math.PI*2; P.push(Math.cos(a)*R,Math.sin(a)*R,z1); N.push(0,0,1);}
    for(let k=0;k<SEG;k++) I.push(base,base+1+k,base+2+k);
    const pr=doc.createPrimitive()
      .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(bufw))
      .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(bufw))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(bufw)).setMaterial(drumMat);
    return doc.createMesh('Tyre_Drum').addPrimitive(pr);
  };
  const bboxOf=(node)=>{const b=new THREE.Box3(); const M=new THREE.Matrix4().fromArray(node.getWorldMatrix()); const m=node.getMesh();
    if(m) for(const p of m.listPrimitives()){const a=p.getAttribute('POSITION'),t=[0,0,0],v=new THREE.Vector3(); for(let i=0;i<a.getCount();i++){a.getElement(i,t); b.expandByPoint(v.set(...t).applyMatrix4(M))}} return b;};
  let count=0;
  for(const w of root.listNodes().filter(n=>/^YSTAD_20_(FL|FR|RL|RR)_/.test(n.getName()))){
    const rim=w.listChildren().find(c=>/^Rim_/.test(c.getName())); if(!rim) continue;
    const box=new THREE.Box3(); const stack=[rim]; while(stack.length){const n=stack.pop(); box.union(bboxOf(n)); stack.push(...n.listChildren());}
    const c=box.getCenter(new THREE.Vector3()); const diam=box.max.y-box.min.y;
    const sign=c.x>0?1:-1; const xOut=sign>0?box.max.x:box.min.x;
    const WS=parseFloat(process.env.WHEEL_SCALE||'1.02'), WO=parseFloat(process.env.WHEEL_OUT||'-0.004'); const dm=diam*WS;
    const T=new THREE.Matrix4().makeTranslation(xOut+sign*WO-sign*0.241*dm, c.y, c.z)
      .multiply(new THREE.Matrix4().makeRotationY(sign*Math.PI/2))
      .multiply(new THREE.Matrix4().makeScale(dm,dm,dm));
    const local=new THREE.Matrix4().fromArray(w.getWorldMatrix()).invert().multiply(T);
    w.addChild(doc.createNode('Meshy_Wheel_'+w.getName().slice(9,11)).setMesh(wheelMesh).setMatrix(local.toArray()));
    w.addChild(doc.createNode('Tyre_Drum_'+w.getName().slice(9,11)).setMesh(buildDrum(dm)).setMatrix(local.toArray()));
    rim.dispose(); count++;
  }
  console.log('wheels replaced',count);
}

// ---- keep the VW logo unlit: the centre of the DRL strips becomes a dark, non-emissive material ----
{
  const GAP=parseFloat(process.env.LOGO_GAP||'0.13');
  const dark=doc.createMaterial('Logo_Silver').setBaseColorFactor([0.62,0.63,0.66,1]).setMetallicFactor(0.85).setRoughnessFactor(0.3);
  let moved=0;
  for(const nd of root.listNodes()){
    const mesh=nd.getMesh(); if(!mesh) continue;
    const W=new THREE.Matrix4().fromArray(nd.getWorldMatrix()); const v=new THREE.Vector3();
    for(const pr of [...mesh.listPrimitives()]){
      if(!/Glow_DRL/.test(pr.getMaterial()?.getName()||'')) continue;
      const pos=pr.getAttribute('POSITION'), ia=pr.getIndices(), arr=ia.getArray(), t=[0,0,0];
      const keep=[],centre=[];
      for(let i=0;i<arr.length;i+=3){
        let cx=0; for(let k=0;k<3;k++){pos.getElement(arr[i+k],t); cx+=v.set(...t).applyMatrix4(W).x} cx/=3;
        (Math.abs(cx)<GAP?centre:keep).push(arr[i],arr[i+1],arr[i+2]);
      }
      if(!centre.length) continue;
      ia.setArray(new Uint32Array(keep));
      const np=doc.createPrimitive();
      for(const sem of pr.listSemantics()) np.setAttribute(sem,pr.getAttribute(sem));
      np.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(centre)).setBuffer(doc.getRoot().listBuffers()[0])).setMaterial(dark);
      mesh.addPrimitive(np); moved+=centre.length/3;
    }
  }
  console.log('logo centre tris darkened',moved);
}
await doc.transform(prune(), dedup(), weld());
let before=0, after=0;
// Exterior bodywork (fender arches, bumpers) keeps most of its detail; the interior, which is
// only glimpsed through windows and open doors, is reduced much further.
const groupOf=(node)=>{ for(let n=node;n;n=n.getParentNode?.()||null){ const nm=n.getName();
  if(/^Tail_|^Meshy_Wheel/.test(nm)) return 'keep'; if(/^INT/.test(nm)) return 'int'; if(/^EXT_BODY/.test(nm)) return 'body';
  if(/^EXT_DOORS|^EXT_TRUNK/.test(nm)) return 'closure'; if(/^YSTAD|^BRAKES/.test(nm)) return 'wheel'; } return 'other'; };
const PLAN={int:[0.1,0.05],body:[0.85,0.0006],closure:[0.6,0.001],keep:[0.4,0.002],wheel:[0.5,0.002],other:[ratio,err]};
const meshGroup=new Map();
for(const nd of root.listNodes()){ const m=nd.getMesh(); if(m&&!meshGroup.has(m)) meshGroup.set(m,groupOf(nd)); }
const stat={};
for(const mesh of root.listMeshes()) for(const prim of mesh.listPrimitives()){
  const grp=meshGroup.get(mesh)||'other'; const [gRatio,gErr]=PLAN[grp];
  const idx=prim.getIndices(); const pos=prim.getAttribute('POSITION'); if(!idx||!pos) continue;
  const n=idx.getCount(); before+=n/3;
  if(n<900){ after+=n/3; continue; }
  const count=pos.getCount();
  const P=new Float32Array(count*3), A=new Float32Array(count*5);
  const nor=prim.getAttribute('NORMAL'), uv=prim.getAttribute('TEXCOORD_0');
  const t=[0,0,0];
  for(let i=0;i<count;i++){ pos.getElement(i,t); P.set(t,i*3);
    if(uv){const u=[0,0]; uv.getElement(i,u); A[i*5]=u[0];A[i*5+1]=u[1];}
    if(nor){nor.getElement(i,t); A[i*5+2]=t[0];A[i*5+3]=t[1];A[i*5+4]=t[2];} }
  const target=Math.max(300,Math.floor(n*gRatio/3)*3);
  const [out]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx.getArray()),P,3,A,5,[uvW,uvW,0.5,0.5,0.5],null,target,gErr,grp==='int'?[]:['LockBorder']);
  (stat[grp]??=[0,0]); stat[grp][0]+=n/3; stat[grp][1]+=out.length/3;
  idx.setArray(out.length<65536*3&&count<65536?new Uint16Array(out):out); after+=out.length/3;
}
console.log('tris',Math.round(before),'->',Math.round(after), JSON.stringify(Object.fromEntries(Object.entries(stat).map(([k,v])=>[k,v.map(Math.round)]))));
await doc.transform(prune(), reorder({encoder:MeshoptEncoder}), quantize(), meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(`${WORK}/vehicle.glb`,doc);
