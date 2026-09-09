import defaults from './site-content.defaults.json' with {type:'json'};
export {defaults};
const fail=message=>{throw Object.assign(new Error(message),{status:400})};
export function validateContent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('页面内容必须是对象');
  if(JSON.stringify(input).length>500000)fail('页面内容过大');
  const walk=(value,template,path)=>{
    if(value===undefined)return structuredClone(template);
    if(Array.isArray(template)){
      if(!Array.isArray(value)||value.length>100)fail(path+' 必须是最多100项的列表');
      return value.map((entry,index)=>walk(entry,template[0],path+'.'+index));
    }
    if(template&&typeof template==='object'){
      if(!value||typeof value!=='object'||Array.isArray(value))fail(path+' 格式不正确');
      for(const key of Object.keys(value))if(!Object.hasOwn(template,key))fail(path+'.'+key+' 不是支持的字段');
      return Object.fromEntries(Object.entries(template).map(([key,sample])=>[key,walk(value[key],sample,path+'.'+key)]));
    }
    if(typeof value!==typeof template)fail(path+' 类型不正确');
    if(typeof value==='string'){
      if(value.length>20000)fail(path+' 文本过长');
      if(/(url|src)$/i.test(path)&&value){
        if(!/^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*|#[^\s]*|mailto:[^\s]+)$/i.test(value))fail(path+' 请填写 http(s) 地址或站内绝对路径');
        if(/[\u0000-\u001f\u007f]/.test(value))fail(path+' 地址含控制字符');
      }
      if(path.endsWith('.kind')&&!['work','pond','link'].includes(value))fail('个人延伸类型不正确');
      if(path.endsWith('.icon')&&!['panels','search','network','code','brain','boxes','workflow','chart'].includes(value))fail('能力图标不正确');
      if(path.endsWith('.accent')&&!['lime','yellow','blue'].includes(value))fail('开源项目配色不正确');
    }
    if(typeof value==='number'&&(!Number.isFinite(value)||value<0||value>86400))fail(path+' 数值超出范围');
    return value;
  };
  const result=walk(input,defaults,'content');
  for(const project of result.projects){project.chapters.sort((a,b)=>a.seconds-b.seconds);for(const c of project.chapters)if(!c.placeholder)c.time=Math.floor(c.seconds/60).toString().padStart(2,'0')+':'+Math.floor(c.seconds%60).toString().padStart(2,'0')}
  const ids=result.extension.items.map(x=>x.id);if(ids.some(x=>!x)||new Set(ids).size!==ids.length)fail('个人延伸标识不能为空或重复');
  if(result.extension.items.filter(x=>x.enabled&&x.kind==='pond').length>1)fail('只能启用一个池塘入口');
  const projectKeys=result.projects.map(x=>x.workId||x.slug);if(projectKeys.some(x=>!x)||new Set(projectKeys).size!==projectKeys.length)fail('每项Demo配置需关联不同作品或填写不同网址别名');
  const slugs=result.openSource.items.map(x=>x.slug);if(slugs.some(x=>!x)||new Set(slugs).size!==slugs.length)fail('开源项目网址别名不能为空或重复');
  return result;
}
