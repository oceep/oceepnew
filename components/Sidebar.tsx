import React, { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onToggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onToggleSidebar
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingSessionId]);

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = () => {
    if (editingSessionId && editTitle.trim()) {
      onRenameSession(editingSessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveTitle();
    if (e.key === 'Escape') setEditingSessionId(null);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onToggleSidebar}
      />

      {/* Sidebar Content */}
      <aside 
        className={`fixed md:relative z-30 flex flex-col h-full w-[260px] bg-gray-950 border-r border-gray-800 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 flex-shrink-0">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onToggleSidebar();
            }}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-500 transition-all text-white font-medium shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Trò chuyện mới
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div className="text-xs font-bold text-gray-500 px-3 py-2 uppercase tracking-wider">Lịch sử</div>
          
          {sessions.length === 0 && (
            <div className="text-xs text-gray-600 px-3 italic">Chưa có cuộc trò chuyện nào</div>
          )}
          
          {sessions.map(session => (
            <div 
                key={session.id} 
                className={`group relative flex items-center rounded-lg transition-colors ${
                  currentSessionId === session.id 
                  ? 'bg-gray-800' 
                  : 'hover:bg-gray-900'
                }`}
            >
                {editingSessionId === session.id ? (
                  <input 
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-gray-950 text-white text-sm px-3 py-3 mx-1 rounded border border-blue-500 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      onSelectSession(session.id);
                      if (window.innerWidth < 768) onToggleSidebar();
                    }}
                    className={`flex-1 text-left px-3 py-3 text-sm truncate pr-16 ${
                      currentSessionId === session.id 
                        ? 'text-white' 
                        : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                  >
                    {session.title}
                  </button>
                )}
                
                {/* Actions */}
                {editingSessionId !== session.id && (
                  <div className="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => startEditing(e, session)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                      title="Đổi tên"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                    <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      title="Xóa"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};