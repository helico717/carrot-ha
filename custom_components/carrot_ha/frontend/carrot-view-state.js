// Keep a synchronous data render from disturbing the user's reading position.
// Walk across HA shadow roots: its scrolling container is often not window.
export function preserveView(card, render) {
  const root=card.shadowRoot;
  const path=node=>{
    const parts=[];
    while(node&&node!==root){
      const parent=node.parentNode;if(!parent)return null;
      parts.unshift(Array.prototype.indexOf.call(parent.children,node));node=parent;
    }
    return node===root?parts:null;
  };
  const resolve=parts=>parts?.reduce((node,index)=>node?.children[index],root);
  const scroll=[];
  for(let node=card;node;node=node.parentNode||node.host){
    if(node.nodeType===1)scroll.push([node,node.scrollLeft,node.scrollTop]);
  }
  const inside=Array.from(root.querySelectorAll('*')).filter(node=>node.scrollTop||node.scrollLeft)
    .map(node=>[path(node),node.scrollLeft,node.scrollTop]);
  const details=Array.from(root.querySelectorAll('details')).map(node=>[path(node),node.open]);
  const active=root.activeElement;
  const focus=active?{path:path(active),tag:active.tagName,id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  const height=card.style.minHeight;
  // Prevent a transient height collapse from clamping HA's scroll position.
  card.style.minHeight=`${card.getBoundingClientRect().height}px`;
  try{return render();}
  finally{
    for(const [parts,open] of details){const node=resolve(parts);if(node?.tagName==='DETAILS')node.open=open;}
    if(focus){const node=resolve(focus.path);if(node?.tagName===focus.tag&&node.id===focus.id){node.focus({preventScroll:true});if(focus.start!=null&&node.setSelectionRange)try{node.setSelectionRange(focus.start,focus.end);}catch{}}}
    for(const [parts,x,y] of inside){const node=resolve(parts);if(node){node.scrollLeft=x;node.scrollTop=y;}}
    card.style.minHeight=height;
    for(const [node,x,y] of scroll){node.scrollLeft=x;node.scrollTop=y;}
  }
}
