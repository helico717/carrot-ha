// Part of the optional 3D vehicle model pipeline (see docs/VEHICLE_3D_MODEL.md).
// Input and output files live in the folder named by MODEL_WORK (default ./work); none are committed.
const WORK=process.env.MODEL_WORK||'./work';
import {NodeIO, Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const target=parseInt(process.argv[2]||'30000');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const src=await io.read(`${WORK}/meshy_wheel.glb`);
const node=src.getRoot().listNodes().find(n=>n.getMesh());
const W=new THREE.Matrix4().fromArray(node.getWorldMatrix());
const prm=node.getMesh().listPrimitives()[0]; const pa=prm.getAttribute('POSITION'); const ia=prm.getIndices();
const n=pa.getCount(); const arr=new Float32Array(n*3); const t=[0,0,0], v=new THREE.Vector3();
for(let i=0;i<n;i++){pa.getElement(i,t); v.set(...t).applyMatrix4(W); arr.set([v.x,v.y,v.z],i*3);}
let g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(arr,3)); if(ia) g.setIndex(new THREE.BufferAttribute(new Uint32Array(ia.getArray()),1));
g=mergeVertices(g,1e-4); g.computeVertexNormals();
console.log('merged verts',g.attributes.position.count,'tris',g.index.count/3);
// recentre on bbox centre, normalise diameter to 1
g.computeBoundingBox(); const bb=g.boundingBox; const c=bb.getCenter(new THREE.Vector3()); const sz=bb.getSize(new THREE.Vector3());
const D=Math.max(sz.x,sz.y);
const P=g.attributes.position.array;
for(let i=0;i<P.length;i+=3){P[i]=(P[i]-c.x)/D;P[i+1]=(P[i+1]-c.y)/D;P[i+2]=(P[i+2]-c.z)/D;}
// which z end is the face? compare the hub (r<0.12) mean z and rim lip extent
let hubZ=0,hubN=0,minz=1e9,maxz=-1e9; for(let i=0;i<P.length;i+=3){const r=Math.hypot(P[i],P[i+1]); if(r<0.12){hubZ+=P[i+2];hubN++} minz=Math.min(minz,P[i+2]);maxz=Math.max(maxz,P[i+2])}
console.log('hub mean z',(hubZ/hubN).toFixed(3),'z range',minz.toFixed(3),maxz.toFixed(3),'width/diam',(maxz-minz).toFixed(3));
// z histogram of spoke-region verts (0.2<r<0.45) tells where spokes sit
const hist=new Array(10).fill(0); for(let i=0;i<P.length;i+=3){const r=Math.hypot(P[i],P[i+1]); if(r>0.2&&r<0.45){const b=Math.min(9,Math.floor((P[i+2]-minz)/(maxz-minz)*10));hist[b]++}}
console.log('spoke-region z histogram (minz->maxz)',hist.join(' '));
// simplify
const idx=g.index.array, nor=g.attributes.normal.array;
const [out]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx),new Float32Array(P),3,new Float32Array(nor),3,[0.6,0.6,0.6],null,target*3,0.002,['LockBorder']);
console.log('simplified tris',out.length/3);
const doc=new Document(); const buf=doc.createBuffer();
const prim=doc.createPrimitive()
 .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
 .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf))
 .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out)).setBuffer(buf));
doc.createScene().addChild(doc.createNode('wheel').setMesh(doc.createMesh('wheel').addPrimitive(prim)));
const {prune,reorder}=await import('@gltf-transform/functions'); await MeshoptEncoder.ready;
await doc.transform(prune(),reorder({encoder:MeshoptEncoder}));
await io.write(`${WORK}/wheel_clean_raw.glb`,doc);
