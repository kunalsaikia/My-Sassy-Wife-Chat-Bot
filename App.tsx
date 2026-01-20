
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, AppSettings, GroundingSource, SavedMessage } from './types';
import { kunalsAssistantService } from './services/geminiService';
import ChatMessage from './components/ChatMessage';

const STORAGE_KEY = 'kunals_pro_chat_history_v8';
const SETTINGS_KEY = 'kunals_pro_settings_v8';
const SAVED_KEY = 'kunals_pro_saved_wisdom_v8';

export const TAPPI_PERMANENT_IMAGE = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const [regenCount, setRegenCount] = useState<number>(0);
  
  const [settings, setSettings] = useState<AppSettings>({
    model: 'gemini-3-flash-preview',
    useSearch: true,
    useMaps: false,
    voiceLanguage: 'en-US',
    backgroundImage: TAPPI_PERMANENT_IMAGE,
    backgroundOpacity: 0.12,
    isDarkMode: false,
    userAvatar: undefined
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    return messages.filter(m => 
      m.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [messages, searchTerm]);

  useEffect(() => {
    // Initial splash timeout
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 3000);

    const savedHistory = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    const savedWisdom = localStorage.getItem(SAVED_KEY);
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (!parsed.backgroundImage || parsed.backgroundImage.includes('unsplash')) {
             parsed.backgroundImage = TAPPI_PERMANENT_IMAGE;
        }
        setSettings(parsed);
      } catch (e) {
        console.error("Failed to load settings");
      }
    }
    
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setMessages(parsed.map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
      } catch (e) { 
        loadDefaultWelcome(); 
      }
    } else {
      loadDefaultWelcome();
    }

    if (savedWisdom) {
      try {
        setSavedMessages(JSON.parse(savedWisdom).map((sm: any) => ({ ...sm, timestamp: new Date(sm.timestamp) })));
      } catch (e) {
        console.error("Failed to load saved wisdom");
      }
    }

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedMessages));
  }, [savedMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        isSidebarOpen && 
        sidebarRef.current && 
        !sidebarRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = settings.voiceLanguage;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (e: any) => setInput(p => p + ' ' + e.results[0][0].transcript);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [settings.voiceLanguage]);

  const loadDefaultWelcome = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Oh, look who decided to show up! I'm Tappi, Kunal's much smarter and sassier wife. What do you need now, honey? Try not to make it too boring.",
      timestamp: new Date(),
    }]);
  };

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, backgroundImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, userAvatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const copyAllMessages = () => {
    if (messages.length === 0) return;
    const transcript = messages.map(m => {
      const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const role = m.role === 'assistant' ? 'Tappi' : 'Kunal';
      return `[${time}] ${role}: ${m.content}`;
    }).join('\n\n');

    navigator.clipboard.writeText(transcript).then(() => {
      setCopyStatus('Copied to clipboard, honey!');
      setTimeout(() => setCopyStatus(null), 3000);
    }).catch(() => {
      setCopyStatus('Failed to copy...');
      setTimeout(() => setCopyStatus(null), 3000);
    });
  };

  const clearChatHistory = () => {
    if (window.confirm("Kunal, darling, are you sure? I won't forget your mistakes even if I forget this chat!")) {
      localStorage.removeItem(STORAGE_KEY);
      loadDefaultWelcome();
      setSearchTerm('');
      setRegenCount(0);
      setLastUserQuery('');
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    setSearchTerm('');
    setLastUserQuery(currentInput);
    setRegenCount(0);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: currentInput, timestamp: new Date() };
    const assistantId = (Date.now() + 1).toString();
    const placeholderMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, userMessage, placeholderMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const stream = kunalsAssistantService.queryStream(currentInput, settings);
      for await (const update of stream) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId 
            ? { ...msg, content: update.text, sources: update.sources }
            : msg
        ));
      }
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, isStreaming: false } : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, content: "Ugh, Kunal, something went wrong. Try again, dear.", isStreaming: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastUserQuery || isLoading) return;

    const newRegenCount = regenCount + 1;
    setRegenCount(newRegenCount);
    setIsLoading(true);

    const lastMsg = messages[messages.length - 1];
    const assistantId = lastMsg.role === 'assistant' ? lastMsg.id : (Date.now() + 1).toString();

    if (lastMsg.role !== 'assistant') {
       const placeholderMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      setMessages(prev => [...prev, placeholderMsg]);
    } else {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, content: '', isStreaming: true, sources: [] } : msg
      ));
    }

    try {
      const stream = kunalsAssistantService.queryStream(lastUserQuery, settings, newRegenCount);
      for await (const update of stream) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId 
            ? { ...msg, content: update.text, sources: update.sources }
            : msg
        ));
      }
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, isStreaming: false } : msg
      ));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, content: "Kunal, stop it! You've broken me with your constant nagging.", isStreaming: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const saveToWisdom = (msg: Message) => {
    if (savedMessages.find(sm => sm.id === msg.id)) return;
    const newSaved: SavedMessage = {
      id: msg.id,
      content: msg.content,
      timestamp: new Date()
    };
    setSavedMessages(prev => [newSaved, ...prev]);
  };

  const removeSavedMessage = (id: string) => {
    setSavedMessages(prev => prev.filter(sm => sm.id !== id));
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredMessages, isLoading]);

  const showRegenerate = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isLoading;

  if (isSplashActive) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#fdfaf0] dark:bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-jakarta">
        <div className="relative">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-8 border-white dark:border-slate-800 shadow-2xl animate-bounce">
            <img src={TAPPI_PERMANENT_IMAGE} alt="Tappi" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-4 -right-4 bg-orange-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg animate-pulse">
            Boss Mode On
          </div>
        </div>
        <div className="mt-12 text-center px-6">
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 mb-4 tracking-tighter">
            Tappi <span className="text-orange-600">is arriving...</span>
          </h1>
          <p className="text-sm md:text-lg font-bold text-slate-500 dark:text-slate-400 italic">
            "Try to look busy, Kunal. I don't want to see you slacking."
          </p>
        </div>
        <div className="absolute bottom-10 flex space-x-2">
           <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
           <div className="w-3 h-3 bg-orange-400 rounded-full animate-ping" style={{animationDelay:'0.2s'}}></div>
           <div className="w-3 h-3 bg-orange-300 rounded-full animate-ping" style={{animationDelay:'0.4s'}}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${settings.isDarkMode ? 'dark' : ''} flex h-screen w-full relative overflow-hidden font-jakarta`}>
      <div className="fixed inset-0 z-0 bg-[#fdfaf0] dark:bg-slate-950 transition-colors duration-500">
        {settings.backgroundImage && (
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              backgroundImage: `url(${settings.backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: settings.backgroundOpacity,
              filter: 'blur(3px) contrast(1.1)'
            }}
          />
        )}
      </div>

      <button 
        ref={toggleBtnRef}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 lg:hidden"
      >
        <svg className="w-6 h-6 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-80 glass transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} bg-white/70 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 shadow-2xl lg:shadow-none`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl border-4 border-white dark:border-slate-700 bg-orange-100 ring-4 ring-orange-400/20">
              <img src={TAPPI_PERMANENT_IMAGE} alt="Tappi Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-800 dark:text-slate-100 text-xl leading-none">Tappi</h1>
              <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-1">The Better Half AI</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 space-y-8 pr-2">
            <section>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4">Search History</p>
              <div className="px-2 relative">
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Find something, Kunal..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-8 text-xs font-bold focus:ring-2 focus:ring-orange-400 outline-none transition-all"
                />
                <svg className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </section>

            <section>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4">Tappi's Saved Wisdom</p>
              <div className="px-2 space-y-3">
                {savedMessages.length === 0 ? (
                  <p className="text-[10px] italic text-slate-400 px-2">Kunal hasn't saved anything yet...</p>
                ) : (
                  savedMessages.map(sm => (
                    <div key={sm.id} className="group relative bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-200 transition-all cursor-pointer">
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 font-medium">"{sm.content}"</p>
                      <button 
                        onClick={() => removeSavedMessage(sm.id)}
                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Settings</p>
                <button onClick={() => setSettings(s => ({...s, isDarkMode: !s.isDarkMode}))} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {settings.isDarkMode ? "☀️" : "🌙"}
                </button>
              </div>
              <div className="space-y-4 px-2">
                <button 
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">👤</div>
                    <span>User Avatar</span>
                  </div>
                </button>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleUserAvatarUpload} />

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-orange-600">🖼️</div>
                    <span>Background</span>
                  </div>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBackgroundImageUpload} />
              </div>
            </section>

            <section className="pt-4 px-2 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Actions</p>
              <button 
                onClick={copyAllMessages}
                className="w-full py-4 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1" /></svg>
                <span>{copyStatus || 'Copy All Messages'}</span>
              </button>

              <button 
                onClick={clearChatHistory}
                className="w-full py-4 px-4 bg-red-500 hover:bg-red-600 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2"
              >
                <span>Clear Chat History</span>
              </button>
            </section>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative z-10">
        <header className="h-20 flex items-center justify-between px-10">
          <div className="lg:hidden w-10"></div>
          <span className="px-4 py-1.5 bg-white/80 dark:bg-slate-800/80 glass border border-orange-200 dark:border-slate-700 rounded-full text-[11px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider">
            TAPPI - SASSY EDITION
          </span>
          <div className="hidden md:block text-right flex items-center space-x-3">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Context</p>
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase">Kunal's Domain</p>
             </div>
             {settings.userAvatar && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                   <img src={settings.userAvatar} alt="Kunal" className="w-full h-full object-cover" />
                </div>
             )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-16 lg:px-32 py-4">
          <div className="max-w-4xl mx-auto pb-16">
            {filteredMessages.length > 0 ? (
              filteredMessages.map(m => (
                <ChatMessage 
                  key={m.id} 
                  message={m} 
                  onSave={() => saveToWisdom(m)}
                  isSaved={!!savedMessages.find(sm => sm.id === m.id)}
                  userAvatar={settings.userAvatar}
                />
              ))
            ) : null}
            
            {isLoading && !messages[messages.length-1]?.content && (
              <div className="flex justify-start mb-8 message-enter">
                <div className="bg-white/90 dark:bg-slate-800/90 glass rounded-[2rem] rounded-bl-none px-8 py-6 shadow-xl flex items-center space-x-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tappi is thinking...</span>
                </div>
              </div>
            )}

            {showRegenerate && (
              <div className="flex justify-center mt-4 mb-8">
                <button 
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-white/80 dark:bg-slate-800/80 border border-orange-200 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate (Tappi is annoyed)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 md:p-12 lg:pb-16 pt-0">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="relative">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Tappi something smart, Kunal..."
                disabled={isLoading}
                className="w-full bg-white/95 dark:bg-slate-900/95 glass border border-slate-200 dark:border-slate-700 rounded-[2.5rem] py-6 pl-10 pr-32 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-8 focus:ring-orange-400/10 transition-all shadow-2xl font-bold text-lg"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  🎤
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 bg-gradient-to-br from-orange-600 to-yellow-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95"
                >
                  {isLoading ? "..." : "➔"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
