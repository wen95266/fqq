import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'javascript', label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800 my-4">
      {label && (
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
          <span className="text-xs font-mono text-gray-400 uppercase">{label}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};