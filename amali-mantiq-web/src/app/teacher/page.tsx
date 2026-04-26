"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { BookOpen, Users, LogOut, CheckCircle, XCircle, Settings, Bell, RefreshCw, FileText } from 'lucide-react';

type Tab = 'pending' | 'enrollments' | 'prompts';

export default function TeacherDashboard() {
    const { user, logout, authFetch, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('pending');
    const [pendingLessons, setPendingLessons] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [prompts, setPrompts] = useState<any[]>([]);
    const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'teacher')) router.replace('/login');
    }, [user, authLoading, router]);

    useEffect(() => { if (user?.role === 'teacher') loadAll(); }, [user]);

    const loadAll = async () => {
        try {
            const [p, e, pr] = await Promise.all([
                fetch(`${API_URL}/api/lessons/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/enrollments/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API_URL}/api/prompts`).then(r => r.json()).catch(() => ({ data: [] })),
            ]);
            setPendingLessons(p.data || []);
            setEnrollments(e.data || []);
            setPrompts(pr.data || []);
            const map: Record<string, string> = {};
            (pr.data || []).forEach((p: any) => { map[p.prompt_name] = p.prompt_text; });
            setEditingPrompts(map);
        } catch (err) {
            console.error("loadAll error:", err);
        }
    };

    const approveLessonClick = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        loadAll();
    };

    const trashLesson = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/${id}/trash`, { method: 'PATCH' });
        loadAll();
    };

    const approveEnrollment = async (id: number) => {
        await authFetch(`${API_URL}/api/enrollments/${id}/approve`, { method: 'PATCH' });
        loadAll();
    };

    const denyEnrollment = async (id: number) => {
        await authFetch(`${API_URL}/api/enrollments/${id}/deny`, { method: 'PATCH' });
        loadAll();
    };

    const savePrompt = async (name: string) => {
        await authFetch(`${API_URL}/api/prompts`, { method: 'PUT', body: JSON.stringify({ prompt_name: name, prompt_text: editingPrompts[name] }) });
        alert(`Prompt "${name}" saved`);
    };

    if (authLoading || !user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;

    const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
        { key: 'pending', icon: <FileText size={18}/>, label: `Pending Lessons (${pendingLessons.length})` },
        { key: 'enrollments', icon: <Bell size={18}/>, label: `Student Requests (${enrollments.length})` },
        { key: 'prompts', icon: <Settings size={18}/>, label: 'Subject Prompts' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900/80 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                    <div><h1 className="font-bold text-lg">Teacher Dashboard</h1><p className="text-xs text-slate-500">{user.full_name} — {user.email}</p></div>
                </div>
                <button onClick={() => { logout(); router.push('/login'); }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"><LogOut size={16}/> Logout</button>
            </header>

            <div className="flex">
                <nav className="w-64 bg-slate-900/50 border-r border-white/5 min-h-[calc(100vh-65px)] p-4 space-y-1">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </nav>

                <main className="flex-1 p-8">
                    {tab === 'pending' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Pending Lesson Review</h2>
                            {pendingLessons.length === 0 ? <p className="text-slate-500">No pending lessons</p> : (
                                <div className="space-y-3">
                                    {pendingLessons.map((l: any) => (
                                        <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 mr-4">
                                                    <p className="font-bold text-lg">{l.title_english}</p>
                                                    <p className="text-slate-400 mt-1" dir="rtl">{l.title_urdu}</p>
                                                    <p className="text-sm text-slate-500 mt-2">{l.objective?.substring(0, 150)}...</p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => approveLessonClick(l.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Approve</button>
                                                    <button onClick={() => trashLesson(l.id)} className="px-4 py-2 bg-red-600/50 rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"><XCircle size={14}/> Trash</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'enrollments' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Student Enrollment Requests</h2>
                            {enrollments.length === 0 ? <p className="text-slate-500">No pending requests</p> : (
                                <div className="space-y-3">
                                    {enrollments.map((e: any) => (
                                        <div key={e.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                                            <div><p className="font-bold">{e.student_name}</p><p className="text-sm text-slate-400">{e.student_email} → {e.subject_name}</p></div>
                                            <div className="flex gap-2">
                                                <button onClick={() => approveEnrollment(e.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500">Approve</button>
                                                <button onClick={() => denyEnrollment(e.id)} className="px-4 py-2 bg-red-600/50 rounded-lg text-sm hover:bg-red-600">Deny</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'prompts' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Edit Subject Prompts</h2>
                            <div className="space-y-6">
                                {prompts.map((p: any) => (
                                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <h3 className="font-bold text-blue-400 mb-3">{p.prompt_name}</h3>
                                        <textarea value={editingPrompts[p.prompt_name] || ''} onChange={e => setEditingPrompts({...editingPrompts, [p.prompt_name]: e.target.value})}
                                            className="w-full h-48 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-sm font-mono outline-none focus:border-blue-500 resize-y"/>
                                        <button onClick={() => savePrompt(p.prompt_name)} className="mt-3 px-6 py-2 bg-blue-600 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors">Save</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
