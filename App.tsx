import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { streamGeminiResponse, generateImageWithPuter, ModelMode } from './services/geminiService';
import { ChatMessage, ChatSession, Role } from './types';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';

type Theme = 'dark' | 'light' | 'ocean';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isTutorMode, setIsTutorMode] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>('fast');
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const stopGenerationRef = useRef<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) setTheme(savedTheme);

    const savedSessions = localStorage.getItem('oceep_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
        else createNewSession();
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('oceep_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isStreaming]);

  const getCurrentSession = () => sessions.find(s => s.id === currentSessionId);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'Cuộc trò chuyện mới',
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    const newSessions = sessions.filter(s => s.id !== sessionId);
    if (newSessions.length === 0) {
        const newSession: ChatSession = {
            id: uuidv4(),
            title: 'Cuộc trò chuyện mới',
            messages: [],
            createdAt: Date.now()
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
    } else {
        setSessions(newSessions);
        if (currentSessionId === sessionId) {
            setCurrentSessionId(newSessions[0].id);
        }
    }
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
  };

  const updateCurrentSessionMessages = (updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        let newTitle = s.title;
        const newMessages = updater(s.messages);
        if (s.title === 'Cuộc trò chuyện mới' && s.messages.length === 0 && newMessages.length > 0 && newMessages[0].role === Role.USER) {
          const textContent = newMessages[0].content || (newMessages[0].image ? '[Hình ảnh]' : 'Chat mới');
          newTitle = textContent.slice(0, 30) + (textContent.length > 30 ? '...' : '');
        }
        return { ...s, messages: newMessages, title: newTitle };
      }
      return s;
    }));
  };

  const handleStopGeneration = () => {
      stopGenerationRef.current = true;
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (isStreaming || !currentSessionId) return;
    
    const currentMsgs = getCurrentSession()?.messages || [];
    if (messageIndex <= 0 || messageIndex >= currentMsgs.length) return;

    const userPromptMsg = currentMsgs[messageIndex - 1];
    if (userPromptMsg.role !== Role.USER) return; 

    updateCurrentSessionMessages(msgs => msgs.slice(0, messageIndex));
    updateCurrentSessionMessages(msgs => msgs.slice(0, messageIndex - 1));
    
    setInput(userPromptMsg.content);
    if (userPromptMsg.image) setStagedImage(userPromptMsg.image);
    
    setTimeout(() => handleSend(userPromptMsg.content), 0);
  };

  const handleSend = async (manualInput?: string, isImageGenRequest: boolean = false) => {
    const textToSend = manualInput !== undefined ? manualInput : input;
    
    if ((!textToSend.trim() && !stagedImage) || isStreaming || !currentSessionId) return;

    stopGenerationRef.current = false;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: Role.USER,
      content: textToSend.trim(),
      image: stagedImage || undefined
    };

    const aiMsgId = uuidv4();
    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      role: Role.MODEL,
      content: '',
      isStreaming: true
    };

    setInput('');
    setStagedImage(null);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    updateCurrentSessionMessages(prev => [...prev, userMsg, aiMsgPlaceholder]);
    setIsStreaming(true);

    try {
      if (isImageGenRequest) {
          const imageUrl = await generateImageWithPuter(userMsg.content);
          updateCurrentSessionMessages(prev => prev.map(msg => 
            msg.id === aiMsgId 
              ? { ...msg, content: `Đã tạo ảnh theo yêu cầu: "${userMsg.content}"`, image: imageUrl, isStreaming: false } 
              : msg
          ));
      } else {
          const currentHistory = sessions.find(s => s.id === currentSessionId)?.messages || [];
          const result = await streamGeminiResponse(
              currentHistory, 
              userMsg.content, 
              isSearchEnabled, 
              userMsg.image, 
              isTutorMode,
              modelMode
          );

          let fullText = '';
          let groundingMetadata: any = null;
          
          if (result && typeof result[Symbol.asyncIterator] === 'function') {
            for await (const chunk of result) {
              if (stopGenerationRef.current) break;

              // Check if chunk is grounding metadata object
              if (typeof chunk === 'object' && chunk.groundingChunks) {
                  groundingMetadata = chunk;
                  updateCurrentSessionMessages(prev => prev.map(msg => 
                      msg.id === aiMsgId ? { ...msg, groundingMetadata: groundingMetadata } : msg
                  ));
                  continue;
              }

              if (typeof chunk === 'string') {
                fullText += chunk;
                updateCurrentSessionMessages(prev => prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, content: fullText } : msg
                ));
              }
            }
          }
      }
    } catch (error: any) {
      console.error("Error:", error);
      updateCurrentSessionMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, content: `Lỗi: ${error.message || 'Không xác định'}` } : msg
      ));
    } finally {
      setIsStreaming(false);
      updateCurrentSessionMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
      ));
    }
  };

  const handleRandomPrompt = () => {
    const prompts = [
      "Kể cho tôi nghe một câu chuyện cười",
      "Viết một đoạn code Python để in ra dãy số Fibonacci",
      "Tóm tắt tin tức công nghệ mới nhất hôm nay",
      "Công thức làm món Phở Bò ngon?",
      "Giải thích thuyết tương đối rộng cho trẻ em"
    ];
    const random = prompts[Math.floor(Math.random() * prompts.length)];
    handleSend(random);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setStagedImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getThemeClasses = () => {
    switch (theme) {
      case 'light': return 'bg-white text-gray-900';
      case 'ocean': return 'bg-cover bg-center text-white';
      case 'dark': default: return 'bg-gradient-to-br from-[#212935] to-black text-gray-100';
    }
  };

  const getFooterColors = () => {
    if (theme === 'light') {
       return {
         input: 'text-gray-900 placeholder-gray-500',
         icon: 'text-gray-600 hover:bg-gray-200',
         bg: 'bg-white/80 border-gray-300',
         active: 'bg-blue-600 text-white',
         tutorActive: 'bg-purple-600 text-white',
         searchActive: 'bg-emerald-600 text-white',
         popup: 'bg-white border-gray-200 text-gray-800 shadow-xl'
       };
    }
    return {
       input: 'text-gray-200 placeholder-gray-400',
       icon: 'text-gray-300 hover:bg-white/10',
       bg: 'bg-black/30 border-white/20',
       active: 'bg-blue-600 text-white',
       tutorActive: 'bg-purple-600 text-white',
       searchActive: 'bg-emerald-600 text-white',
       popup: 'bg-[#1e1e24] border-gray-700 text-white shadow-2xl'
    };
  };
  
  const footerColors = getFooterColors();
  const currentMessages = getCurrentSession()?.messages || [];

  // Model Display Info
  const getModelInfo = () => {
      switch(modelMode) {
          case 'smart': return { name: 'Thông minh', icon: (
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          )};
          case 'fast': default: return { name: 'Nhanh', icon: (
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          )};
      }
  }

  const currentModel = getModelInfo();

  return (
    <div className={`relative flex h-screen w-screen overflow-hidden transition-colors duration-500 ${getThemeClasses()}`} style={theme === 'ocean' ? { backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1173&auto=format&fit=crop')" } : {}}>
      {theme === 'ocean' && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}

      {/* Sidebar Component */}
      <Sidebar 
        isOpen={isSidebarOpen}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 h-full w-full">
        {/* Header */}
        <header className="p-4 flex justify-between items-center z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center text-xl font-semibold select-none">
                    <svg width="28" height="28" viewBox="0 0 100 100">
                        <defs>
                            <radialGradient id="bubbleGradient" cx="0.3" cy="0.3" r="0.7">
                                <stop offset="0%" style={{stopColor:'rgb(220,240,255)', stopOpacity:1}} />
                                <stop offset="100%" style={{stopColor:'rgb(51, 149, 240)', stopOpacity:1}} />
                            </radialGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="url(#bubbleGradient)" stroke="rgba(255,255,255,0.7)" strokeWidth="3"/>
                        <path d="M 35 30 A 25 25 0 0 1 60 55" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="5" strokeLinecap="round"/>
                    </svg>
                    <span className="text-blue-400 text-2xl ml-0.5 font-semibold">ceep</span>
                </div>

                <div className={`flex items-center gap-1 p-1 rounded-full backdrop-blur ${theme === 'light' ? 'bg-gray-200/50' : 'bg-white/5'}`}>
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`w-10 h-10 flex items-center justify-center rounded-full md:hidden active:scale-90 transition-transform ${theme === 'light' ? 'text-gray-700 hover:bg-white' : 'text-white hover:bg-white/10'}`}>
                        {isSidebarOpen ? (
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        ) : (
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        )}
                     </button>
                     <button onClick={createNewSession} className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform ${theme === 'light' ? 'text-gray-700 hover:bg-white' : 'text-white hover:bg-white/10'}`} title="Chat Mới">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                     </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                 <button className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold active:scale-90 transition-transform ${theme === 'light' ? 'text-gray-700 hover:bg-white/50' : 'text-white hover:bg-white/10'}`}>VI</button>
                 <button onClick={() => setShowThemeModal(true)} className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform ${theme === 'light' ? 'text-gray-700 hover:bg-white/50' : 'text-white hover:bg-white/10'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>
                 </button>
            </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col p-4 overflow-hidden">
             {currentMessages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center animate-fade-up">
                     <h1 className={`text-5xl font-bold mb-4 opacity-90 ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                        {new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'}
                     </h1>
                </div>
             ) : (
                <div key={currentSessionId} className="w-full max-w-3xl mx-auto flex-grow mb-4 overflow-y-auto px-2 animate-fade-up">
                   {currentMessages.map((msg, idx) => (
                      <MessageBubble 
                          key={msg.id} 
                          message={msg} 
                          theme={theme} 
                          onRegenerate={msg.role === Role.MODEL && !msg.isStreaming ? () => handleRegenerate(idx) : undefined}
                      />
                   ))}
                   <div ref={bottomRef}></div>
                </div>
             )}
        </main>

        {/* Footer Input */}
        <footer className="w-full max-w-3xl mx-auto px-4 pb-4 z-20">
            <div className={`relative flex flex-col backdrop-blur-lg rounded-[2rem] shadow-lg p-1.5 border transition-colors duration-300 ${footerColors.bg}`}>
                
                {/* Staged Image Preview */}
                {stagedImage && (
                  <div className="px-4 pt-2 relative inline-block w-fit">
                    <img src={stagedImage} alt="Preview" className="h-16 rounded-lg border border-white/20" />
                    <button 
                      onClick={() => setStagedImage(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="flex items-end w-full">
                    
                    {/* Auto-growing Textarea */}
                    <textarea 
                       ref={textareaRef}
                       value={input}
                       onChange={(e) => {
                         setInput(e.target.value);
                         e.target.style.height = 'auto';
                         e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleSend();
                         }
                       }}
                       placeholder={isTutorMode ? "Hỏi thầy giáo..." : "Bạn muốn biết gì?"} 
                       rows={1}
                       disabled={isStreaming}
                       className={`flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-lg pl-5 py-3 resize-none max-h-[150px] ${footerColors.input} disabled:opacity-50`}
                    />
                    
                    <div className="flex items-center shrink-0 pr-1 pb-1.5 gap-1">
                         {/* Model Selector Toggle */}
                         <div className="relative group" ref={modelSelectorRef}>
                            <button 
                                onClick={() => setShowModelSelector(!showModelSelector)} 
                                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-colors active:scale-95 transform ${showModelSelector ? footerColors.active : footerColors.icon}`}
                            >
                                {currentModel.icon}
                                <span className="text-sm font-semibold max-w-[100px] truncate hidden sm:block">{currentModel.name}</span>
                            </button>
                            
                            {/* Model Selector Popup */}
                            {showModelSelector && (
                                <div className={`absolute bottom-full left-0 mb-3 w-80 rounded-xl border p-2 flex flex-col gap-1 z-50 animate-scale-in origin-bottom-left ${footerColors.popup}`}>
                                    <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Chọn chế độ</div>
                                    
                                    <button onClick={() => {setModelMode('fast'); setShowModelSelector(false)}} className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${modelMode === 'fast' ? 'bg-blue-600/10' : 'hover:bg-gray-500/10'}`}>
                                        <div className={`p-1.5 rounded-full ${modelMode === 'fast' ? 'bg-blue-600 text-white' : 'bg-gray-500/20 text-gray-400'}`}>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-semibold text-sm ${modelMode === 'fast' ? 'text-blue-500' : ''}`}>Nhanh</div>
                                            <div className="text-xs opacity-70">Nhanh chóng cho các tác vụ hàng ngày</div>
                                        </div>
                                        {modelMode === 'fast' && <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                    </button>

                                    <button onClick={() => {setModelMode('smart'); setShowModelSelector(false)}} className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${modelMode === 'smart' ? 'bg-blue-600/10' : 'hover:bg-gray-500/10'}`}>
                                        <div className={`p-1.5 rounded-full ${modelMode === 'smart' ? 'bg-blue-600 text-white' : 'bg-gray-500/20 text-gray-400'}`}>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-semibold text-sm ${modelMode === 'smart' ? 'text-blue-500' : ''}`}>Thông minh</div>
                                            <div className="text-xs opacity-70">Suy nghĩ kỹ nhất, đưa ra câu trả lời đầy đủ và chi tiết</div>
                                        </div>
                                        {modelMode === 'smart' && <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                </div>
                            )}
                         </div>

                         {/* Search Toggle (Compact) */}
                         <div className="relative group">
                            <button 
                                onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                                disabled={isStreaming}
                                className={`p-2.5 rounded-full transition-colors active:scale-90 transform ${isSearchEnabled ? footerColors.searchActive : footerColors.icon} disabled:opacity-50`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] px-2 py-1 bg-gray-900 text-white text-xs rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                                {isSearchEnabled ? "Tắt tìm kiếm" : "Tìm kiếm: Tham khảo thông tin từ các nguồn khác"}
                            </span>
                         </div>

                         {/* Image Gen Button */}
                         <div className="relative group">
                             <button 
                                onClick={() => handleSend(undefined, true)}
                                disabled={!input.trim() || isStreaming}
                                className={`p-2.5 rounded-full transition-colors active:scale-90 transform ${footerColors.icon} disabled:opacity-50`}
                             >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                             </button>
                             <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">Tạo ảnh với Dream</span>
                         </div>
                         
                         {/* Upload */}
                         <div className="relative group">
                            <button disabled={isStreaming} onClick={() => fileInputRef.current?.click()} className={`p-2.5 rounded-full transition-colors active:scale-90 transform ${footerColors.icon} disabled:opacity-50`}>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            </button>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleFileSelect}
                            />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none">Tải ảnh</span>
                         </div>

                         {/* Tutor Mode Toggle */}
                         <div className="relative group">
                             <button 
                                onClick={() => setIsTutorMode(!isTutorMode)}
                                disabled={isStreaming}
                                className={`p-2.5 rounded-full transition-colors active:scale-90 transform ${isTutorMode ? footerColors.tutorActive : footerColors.icon} disabled:opacity-50`}
                             >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                             </button>
                             <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">{isTutorMode ? "Tắt chế độ Gia Sư" : "Chế độ Gia Sư"}</span>
                         </div>

                         {/* Send / Stop Button */}
                         {isStreaming ? (
                            <button onClick={handleStopGeneration} className="flex items-center justify-center w-11 h-11 bg-white text-black rounded-full transition-colors shrink-0 ml-1 shadow-lg active:scale-90 transform animate-pulse">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                             </button>
                         ) : (input.trim() || stagedImage) ? (
                             <button onClick={() => handleSend()} className="flex items-center justify-center w-11 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors shrink-0 ml-1 shadow-lg active:scale-90 transform">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>
                             </button>
                         ) : (
                             <button className={`flex items-center justify-center w-11 h-11 rounded-full transition-colors shrink-0 ml-1 cursor-default ${theme === 'light' ? 'bg-gray-200 text-gray-400' : 'bg-gray-200/20 text-gray-500'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>
                             </button>
                         )}
                    </div>
                </div>
            </div>
            <p className={`text-center text-xs mt-2 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>AI có thể mắc lỗi. Hãy cân nhắc kiểm tra thông tin quan trọng.</p>
        </footer>
      </div>

      {/* Theme Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowThemeModal(false)}>
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-5 text-white text-center">Chọn Giao Diện</h2>
                <div className="grid grid-cols-3 gap-4">
                    <button onClick={() => {setTheme('dark'); setShowThemeModal(false)}} className={`p-4 rounded-lg border active:scale-95 transition-transform ${theme === 'dark' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:bg-white/5'} flex flex-col items-center gap-2 text-white`}>
                        <div className="w-full h-12 bg-[#212935] rounded ring-1 ring-white/10"></div>
                        <span className="text-sm">Tối</span>
                    </button>
                    <button onClick={() => {setTheme('light'); setShowThemeModal(false)}} className={`p-4 rounded-lg border active:scale-95 transition-transform ${theme === 'light' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:bg-white/5'} flex flex-col items-center gap-2 text-white`}>
                        <div className="w-full h-12 bg-white rounded ring-1 ring-white/10"></div>
                        <span className="text-sm">Sáng</span>
                    </button>
                    <button onClick={() => {setTheme('ocean'); setShowThemeModal(false)}} className={`p-4 rounded-lg border active:scale-95 transition-transform ${theme === 'ocean' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:bg-white/5'} flex flex-col items-center gap-2 text-white`}>
                         <div className="w-full h-12 rounded bg-cover ring-1 ring-white/10" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1173')"}}></div>
                        <span className="text-sm">Biển</span>
                    </button>
                </div>
                <button onClick={() => setShowThemeModal(false)} className="mt-6 w-full py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors active:scale-95">Đóng</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;