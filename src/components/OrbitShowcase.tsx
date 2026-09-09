import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { Work } from '../types';
import { workShowcaseOverrides, placeholderMetrics, placeholderChapters } from '../data/showcaseProjects';
import './orbit-showcase.css';

export function OrbitShowcase({works}:{works:Work[]}) {
  const [selected,setSelected]=useState(0);
  const [chapter,setChapter]=useState(0);
  const video=useRef<HTMLVideoElement>(null);
  if(!works.length)return <p>项目内容待补充</p>;
  const work=works[selected];
  const config=workShowcaseOverrides[work.slug]||{};
  const chapters=config.chapters||placeholderChapters;
  const metrics=[...(config.metrics||placeholderMetrics)];
  while(metrics.length<4)metrics.push({value:'待补充',label:'效果指标',placeholder:true});
  const choose=(index:number)=>{video.current?.pause();setSelected((index+works.length)%works.length);setChapter(0)};
  const neighbors=[-3,-2,-1,1,2,3].slice(0,Math.min(6,works.length-1));
  const cover=(item:Work,index:number)=>item.slug==='kolpilot-ai-creator-decision'?'/kolpilot-project-panorama.png':item.cover_url||`/xiaoyang-card-final-${index%7+1}.jpg`;
  return <div className="orbit-showcase" onKeyDown={event=>{if((event.target as HTMLElement).closest('video'))return;if(event.key==='ArrowLeft'){event.preventDefault();choose(selected-1)}if(event.key==='ArrowRight'){event.preventDefault();choose(selected+1)}}}>
    <div className="orbit-corner">SELECTED WORKS<span>用 AI 创造更大的可能</span><small>BUILD A MORE<br/>OPEN AI FUTURE</small></div>
    <header className="orbit-heading"><p>DEMO SHOWCASE</p><h2>Demo展示</h2><div>从想法到产品 · 用设计与技术落地真实价值</div><small>FROM IDEAS TO IMPACT · REAL PRODUCTS, REAL VALUE</small></header>
    <div className="orbit-stage"><div className="orbit-ring" aria-hidden="true"><i/><i/><i/><i/></div>
      {neighbors.map((offset)=>{const index=(selected+offset+works.length)%works.length;const item=works[index];return <button key={offset} className={`orbit-wing side-${offset<0?'left':'right'} distance-${Math.abs(offset)}`} onClick={()=>choose(index)} aria-label={`查看项目：${item.title}`}><span className="orbit-wing-number">{String(index+1).padStart(2,'0')}</span><small>{item.kicker}</small><h3>{item.title}</h3><img src={cover(item,index)} alt="" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=`/xiaoyang-card-final-${index%7+1}.jpg`}}/><p>{item.summary}</p><small>{item.stack.slice(0,2).join(' / ')}</small></button>})}
      <article className="orbit-feature" key={work.id}>
        <div className="orbit-feature-heading"><b>{String(selected+1).padStart(2,'0')}</b><div><h3>{work.title}</h3><small>{work.kicker}</small></div><span><Sparkles size={15}/> FEATURED PROJECT</span></div>
        {config.videoSrc?<video ref={video} src={config.videoSrc} poster={cover(work,selected)} controls playsInline preload="metadata" onTimeUpdate={event=>setChapter(chapters.reduce((found,item,index)=>!item.placeholder&&event.currentTarget.currentTime>=item.seconds?index:found,0))}/>:<div className="orbit-empty-video"><img src={cover(work,selected)} alt={work.title}/><span>项目演示视频待补充</span></div>}
      </article>
      <button className="orbit-arrow previous" aria-label="上一个项目" onClick={()=>choose(selected-1)}><ArrowLeft/></button><button className="orbit-arrow next" aria-label="下一个项目" onClick={()=>choose(selected+1)}><ArrowRight/></button>
    </div>
    <div className="orbit-details" aria-live="polite"><div className="orbit-description"><h3><b>{String(selected+1).padStart(2,'0')}</b>{work.title}</h3><p>{work.summary}</p><div className="orbit-tags">{work.stack.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</div><div className="orbit-access">{config.demoUrl?<a href={config.demoUrl} target="_blank" rel="noreferrer">打开 Demo ↗</a>:<span>Demo 地址待补充</span>}<span>体验码：{config.accessCode||'待补充'}</span></div></div><div className="orbit-evidence"><div className="orbit-metrics">{metrics.map((metric,index)=><div key={index}><strong>{metric.value}</strong><span>{metric.label}</span><small>{['MODULES','INTERPRETABLE','EVIDENCE','ACCURACY'][index]}</small></div>)}</div><div className="orbit-chapters"><span>项目章节<small>CHAPTERS</small></span>{chapters.map((item,index)=><button key={index} disabled={item.placeholder||!config.videoSrc} className={chapter===index?'is-active':''} onClick={()=>{if(video.current){video.current.currentTime=item.seconds;setChapter(index);void video.current.play().catch(()=>{})}}}><small>{item.time}</small><b>{item.label}</b></button>)}</div></div></div>
    <div className="orbit-dots" aria-label="选择展示项目">{works.map((item,index)=><button key={item.id} aria-label={`选择${item.title}`} aria-pressed={selected===index} className={selected===index?'is-active':''} onClick={()=>choose(index)}/>)}</div>
    <footer className="orbit-footer"><span>PORTFOLIO<br/>IDEAS × DESIGN × AI</span><small>{config.note||'个人 Demo · 未提供的数据保留占位'}</small><span>MORE PROJECTS<br/>A BRIGHTER TOMORROW</span></footer>
  </div>;
}
