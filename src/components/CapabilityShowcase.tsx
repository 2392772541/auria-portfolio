import { ArrowUpRight, BarChart3, Boxes, BrainCircuit, Code2, Database, FileSearch, Network, PanelsTopLeft, Zap } from 'lucide-react';
import { capabilities, highlights } from '../data/showcaseProjects';
import './capability-showcase.css';
import { LightAtmosphere } from './SurfaceLight';
const icons = { panels: PanelsTopLeft, search: FileSearch, network: Network, code: Code2, brain: BrainCircuit, boxes: Boxes, workflow: Database, chart: BarChart3 };
export function CapabilityShowcase() {
  return <div className="capability-showcase"><LightAtmosphere/>
    <section id="showcase-capabilities" className="matrix-section" aria-labelledby="matrix-title">
      <header className="matrix-heading"><p>CAPABILITY MATRIX</p><h2 id="matrix-title">能力矩阵</h2><span>从想法到落地，覆盖 AI 应用的全链路能力</span></header>
      <small className="matrix-caption top" aria-hidden="true">BUILD<br/>WITH AI<br/>FOR A BRIGHTER<br/>TOMORROW</small>
      <div className="matrix-cards">{capabilities.map((item, index) => {const Icon = icons[item.icon];return <article className={`matrix-card tone-${[0,5,7].includes(index)?'green':index===2||index===3?'teal':'blue'}`} key={item.title}><div className="matrix-card-content"><span className="matrix-icon"><Icon aria-hidden="true"/></span><ArrowUpRight className="matrix-arrow" aria-hidden="true"/><h3>{item.title}</h3><p>{item.copy}</p></div></article>;})}</div>
      <small className="matrix-caption left" aria-hidden="true">IDEAS<br/>PRODUCTS<br/>PEOPLE<br/>A BRIGHTER<br/>TOMORROW</small>
    </section>
    <section id="showcase-highlights" className="matrix-highlights" aria-labelledby="matrix-highlights-title">
      <div className="matrix-highlight-intro"><header className="matrix-heading"><p>OTHER HIGHLIGHTS</p><h2 id="matrix-highlights-title">其他亮点</h2><span>用行动把想法变成现实</span></header><div className="matrix-highlight-badge"><Zap aria-hidden="true"/><div><strong>持续把想法做成可用产品</strong><small>IDEAS TO REAL PRODUCTS</small></div></div></div>
      <ul className="matrix-highlight-items">{highlights.map((item,index)=><li key={index}><p>{item.lead}<strong>{item.emphasis}</strong>{item.tail}</p><span>{String(index+1).padStart(2,'0')}</span></li>)}</ul>
    </section>
    <div className="matrix-bottom" aria-hidden="true"><span>HUMAN × AI<br/>EXPAND WHAT'S POSSIBLE</span><span>///<br/>A MORE OPEN<br/>INTELLIGENT WORLD</span></div>
  </div>;
}
