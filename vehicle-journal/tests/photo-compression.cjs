const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage();
  const source=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
  await page.setContent('<main></main>');
  await page.addScriptTag({content:source.slice(source.indexOf('async function prepareJournalPhoto'),source.indexOf('const kindNames='))});
  const result=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1800;
   const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
   let seed=123456;
   for(let i=0;i<pixels.data.length;i+=4){for(let j=0;j<3;j++){seed=(Math.imul(seed,1664525)+1013904223)|0;pixels.data[i+j]=seed>>>24;}pixels.data[i+3]=255;}
   ctx.putImageData(pixels,0,0);
   const results=[];
   for(const type of ['image/png','image/jpeg','image/webp']){
    const blob=await new Promise(r=>canvas.toBlob(r,type,1));
    const output=await prepareJournalPhoto(new File([blob],'receipt.'+type.split('/')[1],{type}));
    const bitmap=await createImageBitmap(output);
    results.push({type,input:blob.size,output:output.size,mime:output.type,name:output.name,width:bitmap.width,height:bitmap.height});bitmap.close();
   }
   canvas.width=4032;canvas.height=3024;ctx.fillStyle='white';ctx.fillRect(0,0,4032,3024);ctx.fillStyle='black';ctx.font='80px sans-serif';ctx.fillText('Receipt 12345',200,200);
   const large=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.95));
   const shrunk=await prepareJournalPhoto(new File([large],'phone.jpg',{type:'image/jpeg'}));
   const image=await createImageBitmap(shrunk);results.push({type:'large',width:image.width,height:image.height,output:shrunk.size});image.close();
   canvas.width=40;canvas.height=40;ctx.clearRect(0,0,40,40);
   const transparent=await new Promise(r=>canvas.toBlob(r,'image/png'));
   const white=await createImageBitmap(await prepareJournalPhoto(new File([transparent],'alpha.png',{type:'image/png'})));
   ctx.drawImage(white,0,0);const pixel=[...ctx.getImageData(0,0,1,1).data];white.close();
   const failures=[];
   for(const file of [new File(['broken'],'bad.jpg',{type:'image/jpeg'}),new File(['gif'],'bad.gif',{type:'image/gif'}),new File([new Uint8Array(20*1024*1024+1)],'big.jpg',{type:'image/jpeg'}),new File([],'empty.jpg',{type:'image/jpeg'})]){
    try{await prepareJournalPhoto(file);failures.push(false);}catch(e){failures.push(true);}
   }
   return {results,pixel,failures};
  });
  assert(result.results[0].input>2*1024*1024);
  for(const row of result.results){assert(row.output>0&&row.output<=2*1024*1024);assert(Math.max(row.width,row.height)<=2560);if(row.mime)assert.equal(row.mime,'image/jpeg');}
  assert.deepEqual(result.pixel,[255,255,255,255]);assert(result.failures.every(Boolean));
  console.log('Photo compression browser checks OK',JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
