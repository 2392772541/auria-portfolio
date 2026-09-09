import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './pond-dialog.css';

export function PondDialog({onClose}:{onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const frame=useRef<HTMLIFrameElement>(null);
  useEffect(()=>{
    const previous=document.getElementById('extension-pond') || document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.showModal();
    const escape=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===frame.current?.contentWindow&&event.data==='pond:close')onClose()};
    window.addEventListener('message',escape);
    return()=>{window.removeEventListener('message',escape);document.body.style.overflow=overflow;requestAnimationFrame(()=>previous?.focus({preventScroll:true}))};
  },[onClose]);
  return createPortal(<dialog ref={dialog} className="pond-dialog" aria-labelledby="pond-dialog-title" onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="pond-dialog-shell"><header><div><span>INTERACTIVE EXPERIMENT</span><h2 id="pond-dialog-title">一方池塘</h2></div><button type="button" onClick={onClose} aria-label="关闭池塘体验" autoFocus>关闭 <span aria-hidden="true">×</span></button></header>
    <iframe ref={frame} src="/pond/index.html?embed=1" title="一方池塘：点击水面生成鱼"/>
    <footer>轻点水面，放一条鱼。<span>按 Esc 返回作品集</span></footer></div>
  </dialog>,document.body);
}
