import { BarChart3, Boxes, BrainCircuit, Code2, Database, FileSearch, Network, PanelsTopLeft } from 'lucide-react';
import {useSiteContent} from '../siteContent';
import './capability-showcase.css';
const icons = { panels: PanelsTopLeft, search: FileSearch, network: Network, code: Code2, brain: BrainCircuit, boxes: Boxes, workflow: Database, chart: BarChart3 };
export function CapabilityShowcase() {
  const {capability,highlight}=useSiteContent();
  return <div className="capability-showcase">
    {capability.enabled&&<section id="showcase-capabilities" className="matrix-section" aria-labelledby="matrix-title">
      <header className="matrix-heading"><p>CAPABILITY MATRIX</p><h2 id="matrix-title">{capability.title}</h2><span>{capability.subtitle}</span></header>
      <div className="matrix-cards">{capability.items.map(item => {const Icon = icons[item.icon as keyof typeof icons]||PanelsTopLeft;return <article className="matrix-card" key={item.title}><span className="matrix-icon"><Icon aria-hidden="true"/></span><h3>{item.title}</h3><p>{item.copy}</p></article>;})}</div>
    </section>}
    {highlight.enabled&&<section id="showcase-highlights" className="matrix-highlights" aria-labelledby="matrix-highlights-title">
      <div className="matrix-highlight-intro"><header className="matrix-heading"><p>OTHER HIGHLIGHTS</p><h2 id="matrix-highlights-title">{highlight.title}</h2><span>{highlight.subtitle}</span></header></div>
      <ul className="matrix-highlight-items">{highlight.items.map((item,index)=><li key={index}><p>{item.lead}<strong>{item.emphasis}</strong>{item.tail}</p><span>{String(index+1).padStart(2,'0')}</span></li>)}</ul>
    </section>}
  </div>;
}
