import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { mergeAttributes, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Bold, Code2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Undo2, Upload, Video } from 'lucide-react';
import type { MediaItem } from './types';
import { normalizeRichText, RichContent } from './RichContent';

const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: null }, poster: { default: null } };
  },
  parseHTML() { return [{ tag: 'video[src]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes({ controls: '', playsinline: '', preload: 'metadata' }, HTMLAttributes)];
  },
});

type UploadResult = { name: string; url: string; content_type: string };
type PreviewMeta = { title?: string; excerpt?: string; category?: string; coverUrl?: string; videoUrl?: string };

function ToolButton({ label, active = false, disabled = false, onClick, children }:{ label:string; active?:boolean; disabled?:boolean; onClick:()=>void; children:React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} className={active?'active':''} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function RichTextEditor({ value, onChange, media, upload, previewMeta }:{ value:string; onChange:(html:string)=>void; media:MediaItem[]; upload:(file:File)=>Promise<UploadResult>; previewMeta?:PreviewMeta }) {
  const [busy,setBusy]=useState('');
  const [uploadError,setUploadError]=useState('');
  const [preview,setPreview]=useState(false);
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[
      StarterKit.configure({ link: { openOnClick:false, autolink:true, linkOnPaste:true } }),
      TiptapImage.configure({ resize:{enabled:true,minWidth:120,minHeight:80,alwaysPreserveAspectRatio:true}, HTMLAttributes:{loading:'lazy'} }),
      Youtube.configure({ nocookie:true,controls:true,width:960,height:540 }),
      VideoNode,
    ],
    content:normalizeRichText(value),
    editorProps:{attributes:{class:'tiptap-content','aria-label':'文章正文编辑器'}},
    onUpdate:({editor:instance})=>onChange(instance.getHTML()),
  });
  const state=useEditorState({editor,selector:({editor:instance})=>instance?{
    bold:instance.isActive('bold'),italic:instance.isActive('italic'),strike:instance.isActive('strike'),
    h2:instance.isActive('heading',{level:2}),h3:instance.isActive('heading',{level:3}),
    bullet:instance.isActive('bulletList'),ordered:instance.isActive('orderedList'),quote:instance.isActive('blockquote'),code:instance.isActive('codeBlock'),
  }:null});
  useEffect(()=>{
    if(!editor||editor.isFocused)return;
    const normalized=normalizeRichText(value);
    if(editor.getHTML()!==normalized)editor.commands.setContent(normalized);
  },[editor,value]);
  if(!editor)return <div className="rich-editor-loading">正在加载编辑器…</div>;
  const insertMedia=(item:Pick<MediaItem,'url'|'content_type'>)=>{
    if(item.content_type.startsWith('image/')) editor.chain().focus().setImage({src:item.url}).run();
    else if(item.content_type==='video/mp4') editor.chain().focus().insertContent({type:'video',attrs:{src:item.url}}).run();
  };
  const handleUpload=async(file?:File)=>{
    if(!file)return;
    setBusy(file.name);
    setUploadError('');
    try{const item=await upload(file);insertMedia(item);}
    catch(error){setUploadError(error instanceof Error?error.message:'上传失败，请稍后重试。');}
    finally{setBusy('');}
  };
  const setLink=()=>{
    if(editor.isActive('link')){editor.chain().focus().unsetLink().run();return;}
    const href=window.prompt('请输入链接地址（例如 https://example.com）');
    if(href)editor.chain().focus().extendMarkRange('link').setLink({href}).run();
  };
  const addYoutube=()=>{
    const src=window.prompt('请输入 YouTube 视频链接');
    if(src)editor.commands.setYoutubeVideo({src,width:960,height:540});
  };
  return <div className="rich-editor-shell">
    <div className="rich-toolbar" role="toolbar" aria-label="富文本工具栏">
      <ToolButton label="二级标题" active={state?.h2} onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}><Heading2/></ToolButton>
      <ToolButton label="三级标题" active={state?.h3} onClick={()=>editor.chain().focus().toggleHeading({level:3}).run()}><Heading3/></ToolButton>
      <ToolButton label="加粗" active={state?.bold} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold/></ToolButton>
      <ToolButton label="斜体" active={state?.italic} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic/></ToolButton>
      <ToolButton label="删除线" active={state?.strike} onClick={()=>editor.chain().focus().toggleStrike().run()}><Strikethrough/></ToolButton>
      <ToolButton label="无序列表" active={state?.bullet} onClick={()=>editor.chain().focus().toggleBulletList().run()}><List/></ToolButton>
      <ToolButton label="有序列表" active={state?.ordered} onClick={()=>editor.chain().focus().toggleOrderedList().run()}><ListOrdered/></ToolButton>
      <ToolButton label="引用" active={state?.quote} onClick={()=>editor.chain().focus().toggleBlockquote().run()}><Quote/></ToolButton>
      <ToolButton label="代码块" active={state?.code} onClick={()=>editor.chain().focus().toggleCodeBlock().run()}><Code2/></ToolButton>
      <ToolButton label="链接" onClick={setLink}><Link2/></ToolButton>
      <ToolButton label="分割线" onClick={()=>editor.chain().focus().setHorizontalRule().run()}><Minus/></ToolButton>
      <ToolButton label="清除格式" onClick={()=>editor.chain().focus().clearNodes().unsetAllMarks().run()}><RemoveFormatting/></ToolButton>
      <ToolButton label="撤销" disabled={!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}><Undo2/></ToolButton>
      <ToolButton label="重做" disabled={!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}><Redo2/></ToolButton>
      <label className="tool-upload" title="上传并插入图片"><ImagePlus/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{void handleUpload(e.target.files?.[0]);e.target.value='';}}/></label>
      <label className="tool-upload" title="上传并插入 MP4 视频"><Video/><input type="file" accept="video/mp4" onChange={e=>{void handleUpload(e.target.files?.[0]);e.target.value='';}}/></label>
      <ToolButton label="插入 YouTube 视频" onClick={addYoutube}><Upload/></ToolButton>
    </div>
    {busy&&<div className="editor-uploading">正在上传并插入：{busy}</div>}
    {uploadError&&<div className="editor-upload-error" role="alert">{uploadError}</div>}
    <EditorContent editor={editor}/>
    <div className="editor-meta"><span>{editor.getText().length} 字</span><button type="button" onClick={()=>setPreview(!preview)}>{preview?'返回编辑':'预览内容'}</button></div>
    {preview&&<div className="editor-preview"><p className="eyebrow">LIVE PREVIEW / 完整内容预览</p><article className="editor-preview-article"><header><span>{previewMeta?.category||'未分类'}</span><h2>{previewMeta?.title||'未命名内容'}</h2>{previewMeta?.excerpt&&<p>{previewMeta.excerpt}</p>}</header>{previewMeta?.videoUrl?<video controls playsInline preload="metadata" poster={previewMeta.coverUrl||undefined} src={previewMeta.videoUrl}/>:previewMeta?.coverUrl?<img src={previewMeta.coverUrl} alt="封面预览"/>:null}<RichContent html={editor.getHTML()}/></article></div>}
    {media.length>0&&<div className="editor-media-library"><div><b>从媒体库插入</b><span>点击图片或视频即可插入光标位置</span></div><div>{media.filter(item=>item.content_type.startsWith('image/')||item.content_type==='video/mp4').slice(0,12).map(item=><button type="button" key={item.id} onClick={()=>insertMedia(item)} title={`插入 ${item.name}`}>{item.content_type.startsWith('image/')?<img src={item.url} alt=""/>:<Video/>}<span>{item.name}</span></button>)}</div></div>}
  </div>;
}
