"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { BookOpen, Users, LogOut, CheckCircle, XCircle, Settings, Bell, RefreshCw, FileText, Pencil, X } from 'lucide-react';

type Tab = 'pending' | 'enrollments' | 'students' | 'prompts';

export default function TeacherDashboard() {
    const { user, logout, authFetch, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('pending');
    const [pendingLessons, setPendingLessons] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [prompts, setPrompts] = useState<any[]>([]);
    const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
    const [editingLesson, setEditingLesson] = useState<any>(null);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'teacher')) router.replace('/login');
    }, [user, authLoading, router]);

    useEffect(() => { if (user?.role === 'teacher') loadAll(); }, [user]);

    const loadAll = async () => {
        try {
            const [p, e, pr, st] = await Promise.all([
                fetch(`${API_URL}/api/lessons/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/enrollments/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API_URL}/api/prompts`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/teacher/students`).then(r => r.json()).catch(() => ({ data: [] })),
            ]);
            setPendingLessons(p.data || []);
            setEnrollments(e.data || []);
            setPrompts(pr.data || []);
            setStudents(st.data || []);
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

    const updateLesson = async () => {
        if (!editingLesson) return;
        await authFetch(`${API_URL}/api/lessons/${editingLesson.id}`, { 
            method: 'PUT', 
            body: JSON.stringify({ 
                title_english: editingLesson.title_english, 
                title_urdu: editingLesson.title_urdu, 
                objective: editingLesson.objective,
                definition_classic: editingLesson.definition_classic,
                definition_modern: editingLesson.definition_modern
            }) 
        });
        setEditingLesson(null);
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

    const kickStudent = async (studentId: number) => {
        if (!confirm('Are you sure you want to kick this student out of your classes?')) return;
        await authFetch(`${API_URL}/api/enrollments/student/${studentId}`, { method: 'DELETE' });
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
        { key: 'students', icon: <Users size={18}/>, label: `My Students (${students.length})` },
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
                                                    <button onClick={() => setEditingLesson({...l})} className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 flex items-center gap-1"><Pencil size={14}/> Edit</button>
                                                    <button onClick={() => approveLessonClick(l.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Approve</button>
                                                    <button onClick={() => trashLesson(l.id)} className="px-4 py-2 bg-red-600/50 rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"><XCircle size={14}/> Trash</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Edit Lesson Modal */}
                            {editingLesson && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingLesson(null)}>
                                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Edit Lesson</h3><button onClick={() => setEditingLesson(null)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">English Title</label>
                                                <input value={editingLesson.title_english} onChange={e => setEditingLesson({...editingLesson, title_english: e.target.value})} className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Urdu Title</label>
                                                <input value={editingLesson.title_urdu} onChange={e => setEditingLesson({...editingLesson, title_urdu: e.target.value})} dir="rtl" className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Objective</label>
                                                <textarea value={editingLesson.objective} onChange={e => setEditingLesson({...editingLesson, objective: e.target.value})} className="w-full h-24 px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Classic Definition</label>
                                                    <textarea value={editingLesson.definition_classic} onChange={e => setEditingLesson({...editingLesson, definition_classic: e.target.value})} dir="rtl" className="w-full h-32 px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Modern Definition</label>
                                                    <textarea value={editingLesson.definition_modern} onChange={e => setEditingLesson({...editingLesson, definition_modern: e.target.value})} className="w-full h-32 px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-6"><button onClick={updateLesson} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors">Save Changes</button><button onClick={() => setEditingLesson(null)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">Cancel</button></div>
                                    </div>
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

                    {tab === 'students' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">My Enrolled Students</h2>
                            {students.length === 0 ? <p className="text-slate-500">No students enrolled yet</p> : (
                                <div className="space-y-3">
                                    {students.map((s: any) => (
                                        <div key={s.id} className={`flex items-center justify-between border rounded-xl p-4 ${s.is_active ? 'bg-white/5 border-white/10' : 'bg-red-950/20 border-red-500/20 opacity-70'}`}>
                                            <div>
                                                <p className="font-bold flex items-center gap-2">
                                                    {s.full_name} 
                                                    {!s.is_active && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Disabled</span>}
                                                </p>
                                                <p className="text-sm text-slate-400">{s.email}</p>
                                                <p className="text-xs text-blue-400 mt-1">Enrolled in: {s.enrolled_subjects || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <button onClick={() => kickStudent(s.id)} className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30">
                                                    Kick Out
                                                </button>
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
