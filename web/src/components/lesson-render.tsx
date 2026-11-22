"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { httpsLessonUrl, lessonAssetId, lessonAssetUrl, lessonInline, resolveLessonMedia, type LessonBlock, type LessonInline, type LessonRun } from "@/lib/lessons";
import "./lesson.css";

function inline(nodes: LessonInline[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === "plain") return <span key={index}>{node.value}</span>;
    if (node.kind === "fraction") return <span key={index} className="lesson-fraction" role="math" aria-label={`${node.numerator} phần ${node.denominator}`}>
      <span aria-hidden="true">{node.numerator}</span><span aria-hidden="true">{node.denominator}</span>
    </span>;
    if (node.kind === "bold") return <strong key={index}>{inline(node.children)}</strong>;
    if (node.kind === "italic") return <em key={index}>{inline(node.children)}</em>;
    return <u key={index}>{inline(node.children)}</u>;
  });
}

function richInline(runs: LessonRun[]) {
  return runs.map((run, index) => {
    const style: CSSProperties = {
      color: run.marks?.color, fontWeight: run.marks?.bold ? 800 : undefined,
      fontStyle: run.marks?.italic ? "italic" : undefined, textDecoration: run.marks?.underline ? "underline" : undefined,
    };
    if (run.kind === "blank") return <span key={index} className="lesson-blank" style={style} role="img" aria-label="Ô trống" />;
    if (run.kind === "fraction") return <span key={index} className="lesson-fraction" style={style} role="math" aria-label={`${run.numerator} phần ${run.denominator}`}>
      <span aria-hidden="true">{run.numerator}</span><span aria-hidden="true">{run.denominator}</span>
    </span>;
    let text: ReactNode = run.value;
    if (run.marks?.bold) text = <strong>{text}</strong>;
    if (run.marks?.italic) text = <em>{text}</em>;
    if (run.marks?.underline) text = <u>{text}</u>;
    return <span key={index} style={{color:run.marks?.color}}>{text}</span>;
  });
}

function OpenLink({ url, children }: { url: string; children: ReactNode }) {
  return <a className="lesson-link" href={url} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span></a>;
}

function LessonPlayer({ title, url, player, isPdf, managed, inlinePdf }: { title: string; url: string; player: string; isPdf: boolean; managed: boolean; inlinePdf: boolean }) {
  const [open, setOpen] = useState(false);
  const showPdf = isPdf && inlinePdf;
  return open || showPdf ? <iframe
    className={isPdf ? "lesson-pdf" : "lesson-video"}
    title={title}
    src={isPdf && player === "pdf" && !url.includes("#") ? `${url}#view=FitH` : url}
    loading={showPdf ? "lazy" : undefined}
    sandbox={managed ? undefined : player === "pdf" ? "" : "allow-scripts allow-same-origin allow-presentation"}
    referrerPolicy={player === "youtube" ? "strict-origin-when-cross-origin" : "no-referrer"}
    allow={isPdf ? undefined : "fullscreen; encrypted-media; picture-in-picture"}
    allowFullScreen={!isPdf}
  /> : <button className="lesson-play" type="button" onClick={() => setOpen(true)}>{isPdf ? "Xem PDF tại đây" : "Mở trình phát"}</button>;
}

export function LessonRichBlock({ block, preview = false, inlinePdf = false }: { block: LessonBlock; preview?: boolean; inlinePdf?: boolean }) {
  if (block.type === "text") return <p className="lesson-paragraph" style={{ textAlign: block.align }}>{block.rich ? richInline(block.rich) : inline(lessonInline(block.text))}</p>;
  if (block.type === "link") {
    const url = httpsLessonUrl(block.url);
    return url ? <p><OpenLink url={url.href}>{block.label || "Mở liên kết"}</OpenLink></p> : null;
  }
  const asset = ("assetId" in block && lessonAssetId.safeParse(block.assetId).success) ? lessonAssetUrl(block.assetId!) : null;
  const resolved = asset ? { src: asset, open: asset, player: block.type === "pdf" ? "pdf" : "native" }
    : block.url ? resolveLessonMedia(block.type, block.url) : null;
  if (!resolved) return null;
  const title = block.label || ({ image: "Ảnh bài học", pdf: "Tài liệu PDF", video: "Video bài học", audio: "Âm thanh bài học" }[block.type]);
  if (block.type === "image") return <figure className="lesson-image" style={{ width: `${block.width}%` }}>
    {/* The source is either a checked HTTPS URL or a class-authorized local upload; retain the image's actual ratio. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={resolved.src} alt={block.label || "Hình minh họa bài học"} loading="lazy" referrerPolicy="no-referrer" />
    {block.label && <figcaption>{block.label}</figcaption>}
  </figure>;
  return <figure className="lesson-media">
    <figcaption>{title}</figcaption>
    {!preview && (resolved.player !== "native"
      ? <LessonPlayer key={resolved.src} title={title} url={resolved.src} player={resolved.player} isPdf={block.type === "pdf"} managed={!!asset} inlinePdf={inlinePdf} />
      : block.type === "video"
        ? <video className="lesson-video" src={resolved.src} controls playsInline preload="none" aria-label={title} />
        : <audio className="lesson-audio" src={resolved.src} controls preload="none" aria-label={title} />)}
    {!(block.type === "pdf" && inlinePdf) && <OpenLink url={resolved.open}>{block.type === "pdf" ? "Mở PDF trong tab mới" : "Mở nguồn"}</OpenLink>}
  </figure>;
}

export function LessonContent({ blocks, inlinePdf = false }: { blocks: LessonBlock[]; inlinePdf?: boolean }) {
  return <div className="lesson-content">{blocks.map((block, index) => <LessonRichBlock key={index} block={block} inlinePdf={inlinePdf} />)}</div>;
}
