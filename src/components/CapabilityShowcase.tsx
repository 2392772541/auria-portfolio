import { BarChart3, Boxes, BrainCircuit, Code2, Database, FileSearch, Network, PanelsTopLeft } from 'lucide-react';
import { capabilities, highlights } from '../data/showcaseProjects';
import './capability-showcase.css';
const icons = { panels: PanelsTopLeft, search: FileSearch, network: Network, code: Code2, brain: BrainCircuit, boxes: Boxes, workflow: Database, chart: BarChart3 };
export function CapabilityShowcase() {
  return <div className="capability-showcase">
    <section id="showcase-capabilities" className="matrix-section" aria-labelledby="matrix-title">
      <header className="matrix-heading"><p>CAPABILITY MATRIX</p><h2 id="matrix-title">能力矩阵</h2><span>从想法到落地，覆盖 AI 应用的全链路能力</span></header>
      <div className="matrix-cards">{capabilities.map(item => {const Icon = icons[item.icon];return <article className="matrix-card" key={item.title}><span className="matrix-icon"><Icon aria-hidden="true"/></span><h3>{item.title}</h3><p>{item.copy}</p></article>;})}</div>
    </section>
    <section id="showcase-highlights" className="matrix-highlights" aria-labelledby="matrix-highlights-title">
      <div className="matrix-highlight-intro"><header className="matrix-heading"><p>OTHER HIGHLIGHTS</p><h2 id="matrix-highlights-title">其他亮点</h2><span>持续把想法做成可用产品</span></header></div>
      <ul className="matrix-highlight-items">{highlights.map((item,index)=><li key={index}><p>{item.lead}<strong>{item.emphasis}</strong>{item.tail}</p><span>{String(index+1).padStart(2,'0')}</span></li>)}</ul>
    </section>
  </div>;
}
