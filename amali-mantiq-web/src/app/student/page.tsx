"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { BookOpen, Lock, CheckCircle, Clock, LogOut, RefreshCw, GraduationCap, Send, FileQuestion, Lightbulb, MessageSquare, AlertCircle, ChevronLeft } from 'lucide-react';

type View = 'catalog' | 'lessons' | 'profile';

interface QuizOption { key: string; text: string; }
interface QuizQuestion { id: number; text: string; options: QuizOption[]; correct: string; explanation: string; }

export default function StudentPortal() {
    const { user, logout, authFetch, loading: authLoading } = useAuth();
    const router = useRouter();
    const [view, setView] = useState<View>('catalog');
    const [subjects, setSubjects] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [progress, setProgress] = useState<any[]>([]);
    
    // Lesson viewer state
    const [currentSubject, setCurrentSubject] = useState<any>(null);
    const [lessons, setLessons] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeTab, setActiveTab] = useState<'theory' | 'workbook' | 'tutor'>('theory');
    
    // Quiz state
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
    const [quizChecked, setQuizChecked] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);
    
    // Tutor state
    const [messages, setMessages] = useState<{role: string; text: string}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'student')) router.replace('/login');
    }, [user, authLoading, router]);

    useEffect(() => { if (user?.role === 'student') loadCatalog(); }, [user]);

    const loadCatalog = async () => {
        try {
            const [s, e, p] = await Promise.all([
                fetch(`${API_URL}/api/subjects`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/enrollments/my`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/progress/me`).then(r => r.json()).catch(() => ({ data: [] })),
            ]);
            setSubjects(s.data || []);
            setEnrollments(e.data || []);
            setProgress(p.data || []);
        } catch (err) {
            console.error("loadCatalog error:", err);
        }
    };

    const requestEnrollment = async (subjectId: number) => {
        await authFetch(`${API_URL}/api/enrollments/request`, { method: 'POST', body: JSON.stringify({ subject_id: subjectId }) });
        loadCatalog();
    };

    const openSubjectLessons = async (subject: any) => {
        const res = await fetch(`${API_URL}/api/lessons`);
        const data = await res.json();
        const subjectLessons = (data.data || []).filter((l: any) => l.subject_id === subject.id);
        setLessons(subjectLessons);
        setCurrentSubject(subject);
        setCurrentIndex(0);
        setActiveTab('theory');
        setQuizQuestions([]);
        setQuizAnswers({});
        setQuizChecked(false);
        setMessages([]);
        setView('lessons');
    };

    const getEnrollmentStatus = (subjectId: number) => {
        const e = enrollments.find((en: any) => en.subject_id === subjectId);
        return e ? e.status : null;
    };

    const lesson = lessons[currentIndex] || null;

    const loadQuiz = async () => {
        if (!lesson) return;
        setQuizLoading(true); setQuizQuestions([]); setQuizAnswers({}); setQuizChecked(false);
        try {
            const res = await fetch(`${API_URL}/api/quiz/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: lesson.id }) });
            const json = await res.json();
            if (json.data) setQuizQuestions(json.data);
        } catch {} finally { setQuizLoading(false); }
    };

    const checkQuiz = async () => {
        setQuizChecked(true);
        if (!lesson) return;
        const score = Object.entries(quizAnswers).filter(([qid, ans]) => quizQuestions.find(q => q.id === Number(qid))?.correct === ans).length;
        try { await authFetch(`${API_URL}/api/progress`, { method: 'POST', body: JSON.stringify({ lesson_id: lesson.id, quiz_score: score, quiz_total: quizQuestions.length }) }); } catch {}
    };

    const sendMessage = async () => {
        if (!chatInput.trim() || !lesson) return;
        const userMsg = chatInput;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput(''); setIsSending(true);
        try {
            const res = await fetch(`${API_URL}/api/tutor/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: lesson.id, question: userMsg }) });
            const data = await res.json();
            if (data.reply) setMessages(prev => [...prev, { role: 'tutor', text: data.reply }]);
        } catch { setMessages(prev => [...prev, { role: 'tutor', text: 'Network error.' }]); }
        finally { setIsSending(false); }
    };

    if (authLoading || !user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900/80 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center"><GraduationCap size={20}/></div>
                    <div><h1 className="font-bold text-lg">Student Portal</h1><p className="text-xs text-slate-500">{user.full_name}</p></div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setView('catalog'); setCurrentSubject(null); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === 'catalog' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>Subjects</button>
                    <button onClick={() => { setView('profile'); loadCatalog(); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === 'profile' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>My Progress</button>
                    <button onClick={() => { logout(); router.push('/login'); }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"><LogOut size={16}/></button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-8">
                {/* CATALOG VIEW */}
                {view === 'catalog' && (
                    <div>
                        <h2 className="text-3xl font-bold mb-8">Available Subjects</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subjects.map((s: any) => {
                                const status = getEnrollmentStatus(s.id);
                                return (
                                    <div key={s.id} className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all hover:-translate-y-1">
                                        <h3 className="text-xl font-bold mb-1">{s.name_english}</h3>
                                        <p className="text-slate-400 mb-3" dir="rtl">{s.name_urdu}</p>
                                        <p className="text-sm text-slate-500 mb-4">{s.description || 'No description'}</p>
                                        <p className="text-xs text-slate-600 mb-4">{s.lesson_count} lessons available</p>
                                        
                                        {status === 'approved' ? (
                                            <button onClick={() => openSubjectLessons(s)} className="w-full py-3 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"><CheckCircle size={16}/> Open Lessons</button>
                                        ) : status === 'pending' ? (
                                            <div className="w-full py-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-center text-amber-400 text-sm flex items-center justify-center gap-2"><Clock size={16}/> Awaiting Approval</div>
                                        ) : status === 'denied' ? (
                                            <div className="w-full py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-center text-red-400 text-sm">Access Denied</div>
                                        ) : (
                                            <button onClick={() => requestEnrollment(s.id)} className="w-full py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"><Lock size={16}/> Request Access</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {subjects.length === 0 && <p className="text-slate-500 text-center py-16">No subjects available yet</p>}
                    </div>
                )}

                {/* PROFILE / PROGRESS VIEW */}
                {view === 'profile' && (
                    <div>
                        <h2 className="text-3xl font-bold mb-8">My Progress</h2>
                        {enrollments.filter((e: any) => e.status === 'approved').map((e: any) => {
                            const subjectProgress = progress.filter((p: any) => {
                                const lesson = lessons.find((l: any) => l.id === p.lesson_id);
                                return lesson?.subject_id === e.subject_id;
                            });
                            return (
                                <div key={e.id} className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 mb-4">
                                    <h3 className="text-xl font-bold">{e.subject_name}</h3>
                                    <p className="text-sm text-slate-400 mb-3">{e.subject_name_urdu}</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-emerald-400">{subjectProgress.length}</p>
                                            <p className="text-xs text-slate-500">Completed</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-blue-400">{subjectProgress.filter((p: any) => p.quiz_passed).length}</p>
                                            <p className="text-xs text-slate-500">Quizzes Passed</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-amber-400">{subjectProgress.length > 0 ? Math.round(subjectProgress.reduce((a: number, p: any) => a + (p.quiz_score / p.quiz_total * 100), 0) / subjectProgress.length) : 0}%</p>
                                            <p className="text-xs text-slate-500">Avg Score</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {enrollments.filter((e: any) => e.status === 'approved').length === 0 && <p className="text-slate-500 text-center py-16">No enrolled subjects yet</p>}
                    </div>
                )}

                {/* LESSON VIEWER */}
                {view === 'lessons' && lesson && (
                    <div>
                        <button onClick={() => { setView('catalog'); setCurrentSubject(null); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"><ChevronLeft size={18}/> Back to Subjects</button>
                        
                        <div className="bg-gradient-to-br from-slate-900 to-indigo-950/50 p-8 rounded-3xl border border-white/5 mb-6">
                            <p className="text-sm text-indigo-400 mb-2">{currentSubject?.name_english} — Lesson {currentIndex + 1} / {lessons.length}</p>
                            <h2 className="text-3xl font-bold mb-2">{lesson.title_english}</h2>
                            <p className="text-xl text-slate-400" dir="rtl">{lesson.title_urdu}</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-3 mb-6">
                            {[{key: 'theory', label: 'Theory', icon: <BookOpen size={16}/>}, {key: 'workbook', label: 'Quiz', icon: <FileQuestion size={16}/>}, {key: 'tutor', label: 'AI Tutor', icon: <MessageSquare size={16}/>}].map(t => (
                                <button key={t.key} onClick={() => { setActiveTab(t.key as any); if (t.key === 'workbook' && quizQuestions.length === 0) loadQuiz(); }}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{t.icon} {t.label}</button>
                            ))}
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 min-h-[400px]">
                            {/* THEORY */}
                            {activeTab === 'theory' && (
                                <div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                        <div className="bg-black/40 border border-white/5 p-6 rounded-2xl">
                                            <h3 className="text-lg text-slate-300 mb-4 border-b border-white/10 pb-2">قدیم تصور</h3>
                                            <p className="text-slate-300 leading-relaxed" dir="rtl">{lesson.definition_classic}</p>
                                        </div>
                                        <div className="bg-indigo-950/40 border border-indigo-500/20 p-6 rounded-2xl">
                                            <h3 className="text-lg text-indigo-300 mb-4 border-b border-indigo-500/20 pb-2">Modern Equivalent</h3>
                                            <p className="text-slate-300 leading-relaxed">{lesson.definition_modern}</p>
                                        </div>
                                    </div>
                                    <div className="bg-amber-500/10 border-r-4 border-amber-500 p-5 rounded-xl flex gap-3 items-start">
                                        <Lightbulb className="text-amber-500 shrink-0 mt-1" size={22}/>
                                        <p className="text-amber-200/80" dir="rtl"><strong className="text-amber-500">ہدف:</strong> {lesson.objective}</p>
                                    </div>
                                </div>
                            )}

                            {/* WORKBOOK */}
                            {activeTab === 'workbook' && (
                                <div>
                                    {quizLoading ? (
                                        <div className="flex flex-col items-center py-16 gap-3"><RefreshCw className="animate-spin text-indigo-500" size={28}/><p className="text-slate-500 text-sm">Generating questions...</p></div>
                                    ) : quizQuestions.length === 0 ? (
                                        <div className="text-center py-16"><p className="text-slate-500 mb-4">No questions loaded</p><button onClick={loadQuiz} className="px-6 py-2 bg-indigo-600 rounded-xl text-sm">Generate Quiz</button></div>
                                    ) : (
                                        <div className="space-y-5 max-w-3xl">
                                            {quizQuestions.map(q => (
                                                <div key={q.id} className={`p-5 rounded-2xl border transition-colors ${quizChecked ? (quizAnswers[q.id] === q.correct ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30') : 'bg-white/5 border-white/10'}`}>
                                                    <p className="text-lg font-medium mb-3" dir="rtl">{q.id}. {q.text}</p>
                                                    <div className="flex flex-col gap-2">
                                                        {q.options.map(opt => (
                                                            <button key={opt.key} onClick={() => !quizChecked && setQuizAnswers({...quizAnswers, [q.id]: opt.key})} disabled={quizChecked}
                                                                className={`py-2 px-4 rounded-xl border text-right text-sm transition-colors ${quizChecked && opt.key === q.correct ? 'bg-emerald-600 border-emerald-500 text-white' : quizAnswers[q.id] === opt.key ? (quizChecked ? 'bg-red-600/50 border-red-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white') : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`} dir="rtl">
                                                                <span className="font-bold ml-2">{opt.key})</span> {opt.text}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {quizChecked && q.explanation && <p className="mt-3 text-xs text-slate-400 bg-white/5 p-3 rounded-xl" dir="rtl"><strong className="text-indigo-400">وضاحت: </strong>{q.explanation}</p>}
                                                </div>
                                            ))}
                                            <div className="flex gap-3 mt-6">
                                                <button onClick={checkQuiz} disabled={quizChecked || Object.keys(quizAnswers).length < quizQuestions.length} className="px-6 py-3 bg-white text-slate-950 font-bold rounded-xl disabled:opacity-50 hover:bg-indigo-100 transition-colors">Check Answers</button>
                                                {quizChecked && <button onClick={loadQuiz} className="px-6 py-3 border border-white/20 text-slate-300 rounded-xl hover:bg-white/5">New Questions</button>}
                                            </div>
                                            {quizChecked && (
                                                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                                    <p className="text-xl font-bold">Score: {Object.entries(quizAnswers).filter(([qid, ans]) => quizQuestions.find(q => q.id === Number(qid))?.correct === ans).length} / {quizQuestions.length}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TUTOR */}
                            {activeTab === 'tutor' && (
                                <div className="flex flex-col h-[500px]">
                                    <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
                                        <div className="flex justify-start"><div className="bg-indigo-900/40 border border-indigo-500/30 p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">Hello! I am your AI Tutor for this lesson. Ask me anything about <strong>{lesson.title_english}</strong>.</div></div>
                                        {messages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-white/10 text-white rounded-tl-sm' : 'bg-indigo-900/40 border border-indigo-500/30 text-indigo-100 rounded-tr-sm'}`}>{msg.text}</div>
                                            </div>
                                        ))}
                                        {isSending && <div className="flex justify-start"><div className="bg-indigo-900/20 p-3 rounded-2xl text-indigo-300 text-sm animate-pulse">Thinking...</div></div>}
                                    </div>
                                    <div className="flex gap-3">
                                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Ask a question..." className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500 text-sm"/>
                                        <button onClick={sendMessage} disabled={isSending || !chatInput.trim()} className="px-4 py-3 bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors"><Send size={18}/></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between mt-6">
                            <button onClick={() => { setCurrentIndex(i => Math.max(0, i-1)); setActiveTab('theory'); setQuizQuestions([]); setQuizAnswers({}); setQuizChecked(false); setMessages([]); }} disabled={currentIndex === 0} className="px-6 py-3 border border-white/10 rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors">← Previous</button>
                            <span className="text-slate-500 self-center">{currentIndex + 1} / {lessons.length}</span>
                            <button onClick={() => { setCurrentIndex(i => Math.min(lessons.length-1, i+1)); setActiveTab('theory'); setQuizQuestions([]); setQuizAnswers({}); setQuizChecked(false); setMessages([]); }} disabled={currentIndex >= lessons.length-1} className="px-6 py-3 border border-white/10 rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors">Next →</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
