import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatMessage, Role } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  theme: 'dark' | 'light' | 'ocean';
  onRegenerate?: () => void;
}

const CodeBlock = ({ inline, className, children, theme }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const extensionMap: Record<string, string> = {
      javascript: 'js', python: 'py', html: 'html', css: 'css',
      json: 'json', typescript: 'ts', java: 'java', cpp: 'cpp',
      c: 'c', csharp: 'cs', go: 'go', rust: 'rs', php: 'php',
      ruby: 'rb', shell: 'sh', bash: 'sh', sql: 'sql', md: 'md'
    };
    
    const ext = extensionMap[language.toLowerCase()] || 'txt';
    a.href = url;
    a.download = `code_snippet.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (inline) {
    return (
      <code className={`font-mono rounded px-1 py-0.5 ${theme === 'light' ? 'bg-gray-200 text-red-600' : 'bg-gray-700/50'}`} >
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden bg-[#1e1e1e] border border-gray-700 shadow-xl w-full text-white">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono font-bold uppercase">{language}</span>
        <div className="flex gap-2">
           <button 
              onClick={handleDownload}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Download"
           >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
           </button>
           <button 
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
           >
              {copied ? (
                 <>
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                   Copied
                 </>
              ) : (
                 <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                 </>
              )}
           </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto bg-[#1e1e1e]">
        <code className="font-mono text-sm text-green-400 whitespace-pre">{children}</code>
      </div>
    </div>
  );
};

// Thinking Block Component
const ThinkingBlock = ({ content, theme }: { content: string, theme: string }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
        return (
            <div 
                onClick={() => setIsOpen(true)}
                className={`mb-4 rounded-lg border cursor-pointer transition-colors px-4 py-2 flex items-center gap-2 text-xs font-medium select-none ${
                    theme === 'light' 
                        ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100' 
                        : 'bg-[#1a1a1f] border-gray-800 text-gray-400 hover:bg-[#2d2d35]'
                }`}
            >
                <span className="opacity-70">Suy nghĩ</span>
                <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        );
    }

    return (
        <div className={`mb-4 rounded-lg border overflow-hidden transition-all ${
            theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#1a1a1f] border-gray-800'
        }`}>
            {/* Header */}
            <div className={`px-4 py-2 text-xs font-semibold border-b select-none ${
                theme === 'light' ? 'text-gray-500 border-gray-200 bg-gray-100/50' : 'text-gray-500 border-gray-800 bg-[#2d2d35]/30'
            }`}>
                Suy nghĩ
            </div>

            {/* Content */}
            <div className={`p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
            }`}>
                {content}
            </div>

            {/* Footer */}
            <div 
                onClick={() => setIsOpen(false)}
                className={`px-4 py-2 text-xs cursor-pointer select-none border-t transition-colors flex items-center justify-between group ${
                    theme === 'light' 
                        ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-gray-200' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d35] border-gray-800'
                }`}
            >
                <span>Đóng</span>
                <svg className="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
            </div>
        </div>
    );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, theme, onRegenerate }) => {
  const isUser = message.role === Role.USER;
  const [msgCopied, setMsgCopied] = useState(false);

  const sources = message.groundingMetadata?.groundingChunks?.filter(c => c.web?.uri && c.web?.title) || [];

  const textColorClass = isUser 
    ? 'text-white' 
    : theme === 'light' 
      ? 'text-gray-900' 
      : 'text-gray-100';

  const handleCopyMessage = () => {
      // Copy only the final answer, remove thinking block for clean copy
      const cleanContent = message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      navigator.clipboard.writeText(cleanContent || message.content);
      setMsgCopied(true);
      setTimeout(() => setMsgCopied(false), 2000);
  };

  // Logic to separate Thinking Process from Final Answer
  let thinkingContent = '';
  let displayContent = message.content;

  if (!isUser && message.content.includes('<think>')) {
      const thinkStart = message.content.indexOf('<think>');
      const thinkEnd = message.content.indexOf('</think>');
      
      if (thinkEnd !== -1) {
          // Thinking block is complete
          thinkingContent = message.content.substring(thinkStart + 7, thinkEnd);
          displayContent = message.content.substring(thinkEnd + 8).trim();
      } else {
          // Thinking block is still streaming
          thinkingContent = message.content.substring(thinkStart + 7);
          displayContent = ''; // Hide answer until thinking is done (or show spinner)
      }
  }

  return (
    <div className={`w-full mb-6 flex group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`relative rounded-3xl px-5 py-3 flex flex-col gap-2 animate-pop-in ${
          isUser 
            ? 'bg-blue-600 shadow-md origin-bottom-right ml-auto w-fit max-w-[85%]' 
            : 'bg-transparent origin-bottom-left w-full max-w-[90%] lg:max-w-[80%]' 
        }`}
      >
        {/* Image Attachment (User) */}
        {message.image && (
          <div className="mb-2">
            <img src={message.image} alt="User upload" className="max-w-full h-auto max-h-64 rounded-lg border border-white/20" />
          </div>
        )}

        {/* Thinking Process Block (Model) */}
        {thinkingContent && (
            <ThinkingBlock content={thinkingContent} theme={theme} />
        )}

        {/* Content */}
        <div className={`markdown-body ${textColorClass} ${message.isStreaming ? 'cursor-blink' : ''}`}>
            {displayContent === '' && message.isStreaming && !thinkingContent ? (
               <span className="opacity-0">|</span> 
            ) : (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code: (props) => <CodeBlock {...props} theme={theme} />,
                  p: ({node, ...props}) => <p className={textColorClass} {...props} />,
                  li: ({node, ...props}) => <li className={textColorClass} {...props} />,
                  h1: ({node, ...props}) => <h1 className={`font-bold text-2xl mb-2 ${textColorClass}`} {...props} />,
                  h2: ({node, ...props}) => <h2 className={`font-bold text-xl mb-2 ${textColorClass}`} {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-blue-400" {...props} />
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className={`mt-2 pt-2 border-t flex flex-wrap gap-2 ${isUser ? 'border-white/20' : (theme === 'light' ? 'border-gray-300' : 'border-white/10')}`}>
            {sources.map((chunk, idx) => (
              <a 
                key={idx} 
                href={chunk.web?.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="source-pill"
                title={chunk.web?.title}
              >
                 {chunk.web?.title}
              </a>
            ))}
          </div>
        )}

        {/* Action Buttons (Only for AI, not streaming) */}
        {!isUser && !message.isStreaming && displayContent && (
            <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={handleCopyMessage} 
                    className={`text-xs flex items-center gap-1 ${theme === 'light' ? 'text-gray-500 hover:text-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Sao chép"
                >
                    {msgCopied ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                </button>
                {onRegenerate && (
                    <button 
                        onClick={onRegenerate}
                        className={`text-xs flex items-center gap-1 ${theme === 'light' ? 'text-gray-500 hover:text-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
                        title="Tạo lại câu trả lời"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};