import {useRef,useEffect} from 'react';
import {GlobalWorkerOptions,getDocument,type PDFDocumentProxy,type RenderTask} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
export default function PdfCanvasViewer({url,onReady,onFailure}:{url:string;onReady:()=>void;onFailure:()=>void}){
  const containerRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const container=containerRef.current;
    if(!container)return;
    let cancelled=false;
    let documentTask:ReturnType<typeof getDocument>|undefined;
    let pdfDocument:PDFDocumentProxy|undefined;
    let renderTasks:RenderTask[]=[];
    let resizeTimer:number|undefined;
    let rendering=false;
    const renderDocument=async()=>{
      if(!pdfDocument||cancelled||rendering)return;
      rendering=true;
      try{
        renderTasks.forEach(task=>task.cancel());
        renderTasks=[];
        container.replaceChildren();
        const availableWidth=Math.max(280,Math.min(container.clientWidth-48,980));
        const pixelRatio=Math.min(window.devicePixelRatio||1,2);
        for(let pageNumber=1;pageNumber<=pdfDocument.numPages;pageNumber+=1){
          if(cancelled)return;
          const page=await pdfDocument.getPage(pageNumber);
          const baseViewport=page.getViewport({scale:1});
          const cssScale=availableWidth/baseViewport.width;
          const viewport=page.getViewport({scale:cssScale*pixelRatio});
          const pageElement=document.createElement('figure');
          pageElement.className='resume-pdf-page';
          pageElement.setAttribute('aria-label',`简历第 ${pageNumber} 页，共 ${pdfDocument.numPages} 页`);
          const canvas=document.createElement('canvas');
          canvas.width=Math.ceil(viewport.width);
          canvas.height=Math.ceil(viewport.height);
          canvas.style.width=`${Math.round(viewport.width/pixelRatio)}px`;
          canvas.style.height=`${Math.round(viewport.height/pixelRatio)}px`;
          const context=canvas.getContext('2d',{alpha:false});
          if(!context)throw new Error('Canvas 2D context unavailable');
          pageElement.appendChild(canvas);
          container.appendChild(pageElement);
          const renderTask=page.render({canvas,canvasContext:context,viewport});
          renderTasks.push(renderTask);
          await renderTask.promise;
        }
        if(!cancelled)onReady();
      }finally{rendering=false}
    };
    const load=async()=>{
      try{
        documentTask=getDocument({url,withCredentials:false});
        pdfDocument=await documentTask.promise;
        await renderDocument();
      }catch(error){
        if(cancelled||error instanceof Error&&error.name==='RenderingCancelledException')return;
        onFailure();
      }
    };
    const observer=new ResizeObserver(()=>{
      if(!pdfDocument||cancelled)return;
      if(resizeTimer)window.clearTimeout(resizeTimer);
      resizeTimer=window.setTimeout(()=>{void renderDocument().catch(onFailure)},180);
    });
    observer.observe(container);
    void load();
    return()=>{
      cancelled=true;
      observer.disconnect();
      if(resizeTimer)window.clearTimeout(resizeTimer);
      renderTasks.forEach(task=>task.cancel());
      void documentTask?.destroy();
      if(pdfDocument) void pdfDocument.cleanup().catch(()=>{});
    };
  },[url,onReady,onFailure]);
  return <div ref={containerRef} className="resume-pdf-pages" aria-label="简历 PDF 页面"/>;
}

