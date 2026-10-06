// Isolated visual QA; does not use an existing browser profile or touch HA.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
(async()=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const errors=[];const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync('.preview/journal/hero',{recursive:true});
 let checked=0;
 try{
  for(const [mode,width] of [['mobile',320],['mobile',360],['mobile',402],['max',430],['desktop',768],['desktop',1280],['desktop',1920]]){
   await page.setViewportSize({width,height:1000});
   await page.goto(`http://127.0.0.1:${server.address().port}/review_journal_spending.html?mode=${mode}`);
   await page.locator('.hero-vehicle').evaluate(i=>i.decode());
   for(const period of ['day','month','year']){
    await page.evaluate(p=>setPeriod(p),period);
    const result=await page.locator('#heroCard').evaluate(card=>{
     const box=card.getBoundingClientRect(),image=card.querySelector('.hero-vehicle'),img=image.getBoundingClientRect();
     const note=card.querySelector('#heroNote'),noteBox=note.getBoundingClientRect();
     const ranges=[];
     for(const el of card.querySelectorAll('#heroHeadline .h-phrase, .stat strong, #heroNote')){
      const range=document.createRange();range.selectNodeContents(el);ranges.push(...range.getClientRects());
     }
     const brokenMetrics=[...card.querySelectorAll('.stat strong')].some(el=>{
      const range=document.createRange(),text=el.firstChild,value=el.textContent;
      const unit=value.includes('km/kWh')?'km/kWh':value;
      range.setStart(text,value.indexOf(unit));range.setEnd(text,value.indexOf(unit)+unit.length);
      const rects=[...range.getClientRects()],stat=el.parentElement.getBoundingClientRect();
      return rects.length!==1||rects.some(r=>r.left<stat.left-1||r.right>stat.right+1);
     });
     const outside=ranges.some(r=>r.left<box.left-1||r.right>box.right+1);
     const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
     const context=canvas.getContext('2d');context.drawImage(image,0,0);
     const alpha=context.getImageData(0,0,canvas.width,canvas.height).data;
     const scale=Math.min(img.width/canvas.width,img.height/canvas.height);
     const x0=img.x+(img.width-canvas.width*scale)/2,y0=img.y+(img.height-canvas.height*scale)/2;
     let overlap=0;
     for(let y=noteBox.top;y<noteBox.bottom;y+=2)for(let x=noteBox.left;x<noteBox.right;x+=2){
      const ix=Math.floor((x-x0)/scale),iy=Math.floor((y-y0)/scale);
      if(ix>=0&&iy>=0&&ix<canvas.width&&iy<canvas.height&&alpha[(iy*canvas.width+ix)*4+3]>180)overlap++;
     }
     return {outside,brokenMetrics,imageInside:img.left>=box.left&&img.right<=box.right&&img.top>=box.top&&img.bottom<=box.bottom,
      horizontalOverflow:card.scrollWidth>card.clientWidth,overlap,noteFont:parseFloat(getComputedStyle(note).fontSize)};
    });
    if(result.outside||result.brokenMetrics||!result.imageInside||result.horizontalOverflow||result.overlap<4||result.noteFont<11)throw Error(JSON.stringify({mode,width,period,...result}));
    if(period==='month'||(width===320&&period==='year'))await page.locator('#heroCard').screenshot({path:`.preview/journal/hero/${mode}-${width}-${period}.png`});
    checked++;
   }
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`${checked} hero views verified: complete vehicle bounds, real alpha overlap, readable text bounds, all periods and widths.`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
