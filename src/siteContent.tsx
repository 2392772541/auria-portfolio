import {createContext,useContext} from 'react';
import defaults from '../shared/site-content.defaults.json';
import type {Work} from './types';
export type SiteContent=typeof defaults;
export const defaultSiteContent:SiteContent=defaults;
export const SiteContentContext=createContext<SiteContent>(defaults);
export const useSiteContent=()=>useContext(SiteContentContext);
export function projectConfig(content:SiteContent,work:Work){
  const entry=content.projects.find(item=>item.workId?item.workId===work.id:item.slug===work.slug);
  return {...entry,videoSrc:work.showcase_url?(work.showcase_type==='video'?work.showcase_url:''):entry?.videoSrc||''};
}
