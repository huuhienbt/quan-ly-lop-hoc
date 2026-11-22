import { lessonColors, lessonInline, runsPlainText, type LessonBlock, type LessonInline, type LessonMarks, type LessonRun } from "./lessons";

export type TextBlock = Extract<LessonBlock, { type: "text" }>;
export const emptyText = (): TextBlock => ({ type: "text", text: "", align: "left", rich: [] });
const placeholder = "\u200b";

export function editableRuns(block: TextBlock): LessonRun[] {
  if (block.rich) return block.rich;
  function flatten(nodes: LessonInline[], marks?: LessonMarks): LessonRun[] {
    return nodes.flatMap((node): LessonRun[] => {
      if (node.kind === "plain") return node.value ? [{ kind: "text", value: node.value, ...(marks ? { marks } : {}) }] : [];
      if (node.kind === "fraction") return [{ kind: "fraction", numerator: node.numerator, denominator: node.denominator, ...(marks ? { marks } : {}) }];
      return flatten(node.children, { ...marks, [node.kind]: true });
    });
  }
  return flatten(lessonInline(block.text));
}

export function snapshotText(block: TextBlock, rich: LessonRun[]): TextBlock {
  return { ...block, text: runsPlainText(rich), rich };
}

export function runLength(runs: LessonRun[]) {
  return runs.reduce((sum, entry) => sum + (entry.kind === "text" ? entry.value.length : 1), 0);
}

export function splitRich(runs: LessonRun[], offset: number): [LessonRun[], LessonRun[]] {
  let index = 0;
  const left: LessonRun[] = [], right: LessonRun[] = [];
  for (const entry of runs) {
    const size = entry.kind === "text" ? entry.value.length : 1;
    const cut = offset - index;
    if (cut <= 0) right.push(entry);
    else if (cut >= size) left.push(entry);
    else if (entry.kind === "text") {
      left.push({ ...entry, value: entry.value.slice(0, cut) }); right.push({ ...entry, value: entry.value.slice(cut) });
    }
    index += size;
  }
  return [left, right];
}

function marksFrom(el: HTMLElement, inherited: LessonMarks): LessonMarks {
  const next = { ...inherited };
  if (el.dataset.lessonBold === "1" || el.matches("b,strong")) next.bold = true;
  if (el.dataset.lessonItalic === "1" || el.matches("i,em")) next.italic = true;
  if (el.dataset.lessonUnderline === "1" || el.matches("u")) next.underline = true;
  const color = lessonColors.find((value) => value === el.dataset.lessonColor);
  if (color) next.color = color;
  return next;
}

export function readRich(root: Node): LessonRun[] {
  const result: LessonRun[] = [];
  function append(entry: LessonRun) {
    const previous = result.at(-1);
    if (entry.kind === "text" && previous?.kind === "text" && JSON.stringify(previous.marks) === JSON.stringify(entry.marks)) {
      previous.value += entry.value;
    } else result.push(entry);
  }
  function visit(node: Node, inherited: LessonMarks) {
    if (node.nodeType === 3) {
      const value = node.textContent?.replaceAll(placeholder, "") ?? "";
      if (value) append({ kind: "text", value, marks: inherited });
      return;
    }
    if (node.nodeType !== 1) {
      node.childNodes.forEach(child => visit(child, inherited));
      return;
    }
    const el = node as HTMLElement;
    const marks = marksFrom(el, inherited);
    if (el.dataset.lessonToken === "blank") { append({ kind: "blank", marks }); return; }
    const { lessonNumerator: numerator, lessonDenominator: denominator } = el.dataset;
    if (el.dataset.lessonToken === "fraction" && numerator && denominator) { append({ kind: "fraction", numerator, denominator, marks }); return; }
    if (el.tagName === "BR") { append({ kind: "text", value: "\n", marks }); return; }
    if (el !== root && el.matches("div,p") && node.previousSibling) append({ kind: "text", value: "\n", marks });
    node.childNodes.forEach(child => visit(child, marks));
  }
  root.childNodes.forEach(node => visit(node, {}));
  return result;
}

export function applyMarks(el: HTMLElement, marks: LessonMarks = {}) {
  if (marks.bold) { el.dataset.lessonBold = "1"; el.style.fontWeight = "800"; }
  if (marks.italic) { el.dataset.lessonItalic = "1"; el.style.fontStyle = "italic"; }
  if (marks.underline) { el.dataset.lessonUnderline = "1"; el.style.textDecoration = "underline"; }
  if (marks.color) { el.dataset.lessonColor = marks.color; el.style.color = marks.color; }
}

function toNode(doc: Document, run: LessonRun) {
  const span = doc.createElement("span");
  applyMarks(span, run.marks);
  if (run.kind === "text") span.textContent = run.value;
  else {
    span.contentEditable = "false";
    span.dataset.lessonToken = run.kind;
    if (run.kind === "blank") {
      span.className = "lesson-blank";
      span.setAttribute("aria-label", "Ô trống");
    } else {
      span.className = "lesson-fraction";
      span.dataset.lessonNumerator = run.numerator;
      span.dataset.lessonDenominator = run.denominator;
      span.setAttribute("aria-label", `${run.numerator} phần ${run.denominator}`);
      for (const value of [run.numerator, run.denominator]) {
        const part = doc.createElement("span");
        part.textContent = value; part.setAttribute("aria-hidden", "true"); span.appendChild(part);
      }
    }
  }
  return span;
}

export function writeRich(root: HTMLElement, runs: LessonRun[]) {
  root.replaceChildren(...runs.map(run => toNode(root.ownerDocument, run)));
}

export function readSelection(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const chosen = selection.getRangeAt(0);
  if (!root.contains(chosen.startContainer) || !root.contains(chosen.endContainer)) return null;
  const prefix = chosen.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(chosen.startContainer, chosen.startOffset);
  const start = runLength(readRich(prefix.cloneContents()));
  const end = start + runLength(readRich(chosen.cloneContents()));
  let parent = chosen.startContainer.nodeType === 1 ? chosen.startContainer as HTMLElement : chosen.startContainer.parentElement;
  const ancestors = [];
  while (parent && parent !== root) { ancestors.unshift(parent); parent = parent.parentElement; }
  return { start, end, marks: ancestors.reduce((marks, el) => marksFrom(el, marks), {} as LessonMarks) };
}

export function focusRich(root: HTMLElement, start: number, end = start, typingMarks?: LessonMarks) {
  const doc = root.ownerDocument, selection = doc.getSelection();
  if (!selection) return;
  root.focus();
  const range = doc.createRange();
  function boundary(offset: number): [Node, number] {
    let seen = 0;
    for (const [i, node] of Array.from(root.children).entries()) {
      const child = node as HTMLElement;
      if (child.dataset.lessonToken) {
        if (offset === seen) return [root, i];
        seen++;
      } else {
        const text = child.firstChild;
        const length = (text?.textContent ?? "").length;
        if (text && offset <= seen + length) return [text, offset - seen];
        seen += length;
      }
    }
    return [root, root.childNodes.length];
  }
  range.setStart(...boundary(start)); range.setEnd(...boundary(end));
  if (typingMarks) {
    const carrier = toNode(doc, { kind: "text", value: placeholder, marks: typingMarks });
    range.collapse(true); range.insertNode(carrier);
    range.setStart(carrier.firstChild!, 1); range.collapse(true);
  }
  selection.removeAllRanges(); selection.addRange(range);
}
