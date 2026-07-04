import React from "react";

export function renderMarkdown(text: string) {
  if (!text) return "";
  
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeContent: string[] = [];
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-950 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto my-3 border border-gray-900 w-full">
            <code className="block whitespace-pre">{codeContent.join("\n")}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }
    
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-extrabold text-gray-950 mt-5 mb-2 leading-tight">{parseInlineMarkdown(line.substring(2))}</h1>);
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-gray-950 mt-4 mb-2 border-b border-gray-100 pb-1 leading-tight">{parseInlineMarkdown(line.substring(3))}</h2>);
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-bold text-gray-900 mt-3 mb-1 leading-tight">{parseInlineMarkdown(line.substring(4))}</h3>);
      continue;
    }
    
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const cleanLine = line.trim().substring(2);
      elements.push(
        <ul key={i} className="list-disc pl-5 my-1 text-gray-700">
          <li>{parseInlineMarkdown(cleanLine)}</li>
        </ul>
      );
      continue;
    }
    
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }
    
    elements.push(<p key={i} className="text-gray-700 leading-relaxed text-sm my-1.5">{parseInlineMarkdown(line)}</p>);
  }
  
  return <div className="space-y-1">{elements}</div>;
}

export function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  let keyIdx = 0;
  
  while (currentText.length > 0) {
    const boldIdx = currentText.indexOf("**");
    const codeIdx = currentText.indexOf("`");
    const italicIdx = currentText.indexOf("*");
    
    const targets = [
      { type: "bold", index: boldIdx, length: 2 },
      { type: "code", index: codeIdx, length: 1 },
      { type: "italic", index: italicIdx, length: 1 }
    ].filter(t => t.index !== -1).sort((a, b) => a.index - b.index);
    
    if (targets.length === 0) {
      parts.push(<span key={keyIdx++}>{currentText}</span>);
      break;
    }
    
    const first = targets[0];
    if (first.index > 0) {
      parts.push(<span key={keyIdx++}>{currentText.substring(0, first.index)}</span>);
    }
    
    const rest = currentText.substring(first.index + first.length);
    const closeToken = first.type === "bold" ? "**" : first.type === "code" ? "`" : "*";
    const closeIdx = rest.indexOf(closeToken);
    
    if (closeIdx === -1) {
      parts.push(<span key={keyIdx++}>{currentText.substring(first.index, first.index + first.length)}</span>);
      currentText = rest;
      continue;
    }
    
    const innerText = rest.substring(0, closeIdx);
    if (first.type === "bold") {
      parts.push(<strong key={keyIdx++} className="font-extrabold text-gray-900">{innerText}</strong>);
    } else if (first.type === "code") {
      parts.push(<code key={keyIdx++} className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded font-mono text-xs border border-gray-200">{innerText}</code>);
    } else if (first.type === "italic") {
      parts.push(<em key={keyIdx++} className="italic">{innerText}</em>);
    }
    
    currentText = rest.substring(closeIdx + first.length);
  }
  
  return parts;
}
