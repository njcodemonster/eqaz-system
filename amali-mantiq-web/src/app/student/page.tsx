"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { BookOpen, FileQuestion, Lightbulb, ArrowLeft, ChevronLeft, Bell, RefreshCw, MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface Lesson {
    id: number;
    title_urdu: string;
    title_english: string;
    objective: string;
    definition_classic: string;
    definition_modern: string;
}

interface ChatMessage {
    role: 'user' | 'tutor';
    text: string;
}

export default function StudentLessonViewer() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'theory' | 'workbook' | 'tutor'>('theory');

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Workbook State
    const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
    const [quizChecked, setQuizChecked] = useState(false);

    const lesson = lessons[currentIndex] || null;

    useEffect(() => {
        const fetchLessons = async () => {
            try {
                const res = await fetch(`${API_URL}/api/lessons`);
                const json = await res.json();
                if (json.data && json.data.length > 0) {
                    setLessons(json.data);
                    setCurrentIndex(0);
                }
            } catch (err) {
                console.error("Failed to fetch from DB:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLessons();
    }, []);

    const goNext = () => {
        if (currentIndex < lessons.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setMessages([]);
            setQuizAnswers({});
            setQuizChecked(false);
            setActiveTab('theory');
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setMessages([]);
            setQuizAnswers({});
            setQuizChecked(false);
            setActiveTab('theory');
        }
    };

    const sendMessage = async () => {
        if (!chatInput.trim() || !lesson) return;
        
        const userMsg = chatInput;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput("");
        setIsSending(true);

        try {
            const res = await fetch(`${API_URL}/api/tutor/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lesson_id: lesson.id,
                    user_message: userMsg
                })
            });
            const data = await res.json();
            if (data.reply) {
                setMessages(prev => [...prev, { role: 'tutor', text: data.reply }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'tutor', text: "Network Error: Could not reach tutor." }]);
        } finally {
            setIsSending(false);
        }
    };

    const handleQuizChange = (questionId: number, value: string) => {
        setQuizAnswers(prev => ({...prev, [questionId]: value}));
        setQuizChecked(false);
    };

    const checkQuiz = () => {
        setQuizChecked(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400">
                <RefreshCw size={32} className="animate-spin" />
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 p-8 text-center">
                <div className="max-w-md">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                    <h2 className="text-2xl font-bold mb-2">No Published Lessons</h2>
                    <p>There are currently no active lessons in the database. Please check back later or ask your teacher to publish content.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
            <div className="absolute top-0 right-0 w-full h-[500px] bg-indigo-900/20 blur-[120px] pointer-events-none rounded-full transform translate-x-1/3 -translate-y-1/2"></div>
            
            <div className="max-w-6xl mx-auto p-6 relative z-10">
                <header className="flex justify-between items-center mb-10 backdrop-blur-md bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-100 font-semibold">بیسک</span>
                        <ChevronLeft size={16} />
                        <span>باب 1: مبادیات</span>
                        <ChevronLeft size={16} />
                        <span className="text-indigo-400 font-medium">سبق {lesson.id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold tracking-widest border border-green-500/30">
                            LIVE
                        </div>
                        <button className="p-2 hover:bg-white/10 rounded-full transition-colors relative">
                            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                            <Bell size={20} className="text-slate-300" />
                        </button>
                        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-500/20">
                            ط
                        </div>
                    </div>
                </header>

                <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950/50 p-12 rounded-3xl border border-white/5 mb-8 shadow-xl">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h1 className="text-5xl font-bold text-white mb-4 leading-tight" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                {lesson.title_urdu}
                            </h1>
                            <p className="text-xl text-indigo-200 mb-8 font-light tracking-wide" dir="ltr">
                                {lesson.title_english}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <span className="px-4 py-1.5 bg-white/10 border border-white/10 rounded-full text-sm font-medium">تیسیر المنطق</span>
                            <span className="px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full text-sm font-medium">Epistemology</span>
                        </div>
                    </div>
                </section>

                <div className="flex gap-4 mb-8 bg-white/5 p-2 rounded-2xl backdrop-blur-sm">
                    <TabButton active={activeTab === 'theory'} onClick={() => setActiveTab('theory')} icon={<BookOpen size={20} />} label="نظریاتی حصہ (Theory)" />
                    <TabButton active={activeTab === 'workbook'} onClick={() => setActiveTab('workbook')} icon={<FileQuestion size={20} />} label="عملی ورک بک (Workbook)" />
                    <TabButton active={activeTab === 'tutor'} onClick={() => setActiveTab('tutor')} icon={<MessageSquare size={20} />} label="AI ٹیوٹر (AI Tutor)" />
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-10 min-h-[400px]">
                    
                    {/* THEORY TAB */}
                    {activeTab === 'theory' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl text-indigo-400 mb-8 flex items-center gap-3 border-b border-white/10 pb-4" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                بنیادی تعریفات
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-black/40 border border-white/5 p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 shadow-inner">
                                    <h3 className="text-2xl text-slate-200 mb-6 border-b border-white/10 pb-4" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>قدیم تصور</h3>
                                    <p className="text-xl leading-loose mb-4 font-light text-slate-300" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                        {lesson.definition_classic}
                                    </p>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-center shadow-inner">
                                    <h3 className="text-xl text-indigo-300 mb-6 border-b border-indigo-500/20 pb-4 font-medium" dir="ltr">Modern Equivalent</h3>
                                    <div className="text-lg text-slate-300 leading-relaxed font-light whitespace-pre-wrap" dir="ltr">
                                        {lesson.definition_modern}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 bg-amber-500/10 border-r-4 border-amber-500 p-6 rounded-2xl flex gap-4 text-amber-200/80 items-center">
                                <Lightbulb className="text-amber-500 shrink-0 mt-1" size={28} />
                                <p className="text-xl leading-relaxed font-light" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                    <strong className="text-amber-500 px-2 font-bold">ہدف (Objective):</strong> {lesson.objective}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* WORKBOOK TAB */}
                    {activeTab === 'workbook' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl text-indigo-400 mb-4" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>ذہنی مشق (Mental Exercise)</h2>
                            <p className="text-slate-400 mb-8 border-b border-white/10 pb-4">Read the following phrases and categorize them correctly based on the definitions in the Theory section.</p>
                            
                            <div className="space-y-6 max-w-3xl">
                                {[
                                    { id: 1, text: "سرد موسم (Cold Weather)", correct: "tasawwur" },
                                    { id: 2, text: "سردی آ چکی ہے (Winter has arrived)", correct: "tasdiq" }
                                ].map(q => (
                                    <div key={q.id} className={`p-6 rounded-2xl border transition-colors ${quizChecked ? (quizAnswers[q.id] === q.correct ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30') : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                                        <label className="text-xl text-slate-200 block mb-4 font-medium" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>{q.id}. "{q.text}"</label>
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={() => handleQuizChange(q.id, 'tasawwur')}
                                                className={`flex-1 py-3 px-4 rounded-xl border ${quizAnswers[q.id] === 'tasawwur' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                            >تصور (Apprehension)</button>
                                            <button 
                                                onClick={() => handleQuizChange(q.id, 'tasdiq')}
                                                className={`flex-1 py-3 px-4 rounded-xl border ${quizAnswers[q.id] === 'tasdiq' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                            >تصدیق (Judgment)</button>
                                        </div>
                                        {quizChecked && (
                                            <div className="mt-4 flex items-center gap-2 text-sm">
                                                {quizAnswers[q.id] === q.correct 
                                                    ? <><CheckCircle2 className="text-emerald-500" size={16}/> <span className="text-emerald-400">Correct!</span></>
                                                    : <><AlertCircle className="text-red-500" size={16}/> <span className="text-red-400">Incorrect. Review the theory definitions.</span></>
                                                }
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button onClick={checkQuiz} disabled={Object.keys(quizAnswers).length < 2} className="mt-8 px-8 py-4 bg-white text-slate-950 font-bold rounded-xl disabled:opacity-50 hover:bg-indigo-100 transition-colors">
                                جواب چیک کریں (Check Answers)
                            </button>
                        </div>
                    )}

                    {/* AI TUTOR TAB */}
                    {activeTab === 'tutor' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[500px]">
                            <h2 className="text-3xl text-indigo-400 mb-6 border-b border-white/10 pb-4 shrink-0" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>AI ٹیوٹر (Amali Tutor)</h2>
                            
                            <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-4 custom-scrollbar">
                                <div className="flex justify-start">
                                    <div className="bg-indigo-900/40 border border-indigo-500/30 text-indigo-100 p-4 rounded-2xl rounded-tr-sm max-w-[80%]">
                                        Hello! I am your AI Mantiq Tutor. I have read the lesson <strong>"{lesson.title_urdu}"</strong>. What would you like me to explain further?
                                    </div>
                                </div>
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-4 rounded-2xl max-w-[80%] leading-relaxed ${
                                            msg.role === 'user' 
                                            ? 'bg-white/10 border-white/5 text-white rounded-tl-sm' 
                                            : 'bg-indigo-900/40 border-indigo-500/30 text-indigo-100 rounded-tr-sm'
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isSending && (
                                    <div className="flex justify-start">
                                        <div className="bg-indigo-900/20 border border-indigo-500/10 text-indigo-300 p-4 rounded-2xl rounded-tr-sm flex items-center gap-2">
                                            <RefreshCw className="animate-spin" size={16}/> Thinking...
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative shrink-0">
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder="Ask a question about this lesson... (English or Urdu)" 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-6 py-4 pr-16 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                                    dir="auto"
                                />
                                <button 
                                    onClick={sendMessage}
                                    disabled={isSending || !chatInput.trim()}
                                    className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                <div className="flex justify-between items-center mt-8 pb-12">
                    <button 
                        onClick={goPrev}
                        disabled={currentIndex <= 0}
                        className="px-6 py-3 border border-white/10 text-slate-300 rounded-xl hover:bg-white/5 transition-colors font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        پچھلا سبق
                    </button>
                    <span className="text-slate-500 text-sm font-medium">{currentIndex + 1} / {lessons.length}</span>
                    <button 
                        onClick={goNext}
                        disabled={currentIndex >= lessons.length - 1}
                        className="px-8 py-3 bg-white text-slate-950 font-bold rounded-xl flex items-center gap-3 hover:-translate-x-1 hover:shadow-lg hover:shadow-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:shadow-none"
                    >
                        اگلا سبق <ArrowLeft size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={`flex-1 py-4 px-6 flex items-center justify-center gap-3 rounded-xl font-medium transition-all duration-300 ${
                active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-100' 
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent hover:border-white/10 scale-[0.98]'
            }`}
        >
            {icon} {label}
        </button>
    );
}
