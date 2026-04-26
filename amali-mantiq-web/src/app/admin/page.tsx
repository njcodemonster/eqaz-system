"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { BookOpen, Users, GraduationCap, Upload, Settings, LogOut, Plus, Trash2, UserPlus, Link2, Bell, CheckCircle, XCircle, FileText, RefreshCw, Pencil, X, RotateCcw, Eye, EyeOff, Database } from 'lucide-react';

type Tab = 'overview' | 'lessons' | 'subjects' | 'teachers' | 'enrollments' | 'sources' | 'prompts';

export default function AdminDashboard() {
    const { user, logout, authFetch, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('overview');

    // Data
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [pendingLessons, setPendingLessons] = useState<any[]>([]);
    const [approvedLessons, setApprovedLessons] = useState<any[]>([]);
    const [trashedLessons, setTrashedLessons] = useState<any[]>([]);
    const [sourceDocs, setSourceDocs] = useState<any[]>([]);
    const [lessonView, setLessonView] = useState<'pending' | 'approved' | 'trashed'>('pending');

    // Forms
    const [newSubject, setNewSubject] = useState({ name_english: '', name_urdu: '', description: '' });
    const [newTeacher, setNewTeacher] = useState({ email: '', password: '', full_name: '' });
    const [assignTeacher, setAssignTeacher] = useState({ teacher_id: '', subject_id: '' });
    const [uploadSubjectId, setUploadSubjectId] = useState('');

    // Edit modals
    const [editingSubject, setEditingSubject] = useState<any>(null);
    const [editingTeacher, setEditingTeacher] = useState<any>(null);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'super_admin')) router.replace('/login');
    }, [user, authLoading, router]);

    useEffect(() => { if (user?.role === 'super_admin') loadAll(); }, [user]);

    const loadAll = async () => {
        try {
            const [s, t, e, p, a] = await Promise.all([
                fetch(`${API_URL}/api/subjects`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/teachers`).then(r => r.json()).catch(() => ({ data: [] })),
                authFetch(`${API_URL}/api/enrollments/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API_URL}/api/lessons/pending`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API_URL}/api/lessons`).then(r => r.json()).catch(() => ({ data: [] })),
            ]);
            const tr = await fetch(`${API_URL}/api/lessons/trashed`).then(r => r.json()).catch(() => ({ data: [] }));
            setSubjects(s.data || []);
            setTeachers(t.data || []);
            setEnrollments(e.data || []);
            setPendingLessons(p.data || []);
            setApprovedLessons(a.data || []);
            setTrashedLessons(tr.data || []);
        } catch (err) {
            console.error("loadAll error:", err);
        }
    };

    const createSubject = async () => {
        await authFetch(`${API_URL}/api/subjects`, { method: 'POST', body: JSON.stringify(newSubject) });
        setNewSubject({ name_english: '', name_urdu: '', description: '' });
        loadAll();
    };

    const updateSubject = async () => {
        if (!editingSubject) return;
        await authFetch(`${API_URL}/api/subjects/${editingSubject.id}`, { method: 'PUT', body: JSON.stringify({ name_english: editingSubject.name_english, name_urdu: editingSubject.name_urdu, description: editingSubject.description }) });
        setEditingSubject(null);
        loadAll();
    };

    const deleteSubject = async (id: number) => {
        if (!confirm('Delete this subject? All linked data will be affected.')) return;
        await authFetch(`${API_URL}/api/subjects/${id}`, { method: 'DELETE' });
        loadAll();
    };

    const createTeacher = async () => {
        const res = await authFetch(`${API_URL}/api/users/teacher`, { method: 'POST', body: JSON.stringify(newTeacher) });
        if (res.ok) { setNewTeacher({ email: '', password: '', full_name: '' }); loadAll(); }
        else { const d = await res.json(); alert(d.detail); }
    };

    const updateTeacher = async () => {
        if (!editingTeacher) return;
        await authFetch(`${API_URL}/api/users/teacher/${editingTeacher.id}`, { method: 'PUT', body: JSON.stringify({ full_name: editingTeacher.full_name, email: editingTeacher.email }) });
        setEditingTeacher(null);
        loadAll();
    };

    const deleteTeacher = async (id: number) => {
        if (!confirm('Delete this teacher? Their subject assignments will also be removed.')) return;
        await authFetch(`${API_URL}/api/users/teacher/${id}`, { method: 'DELETE' });
        loadAll();
    };

    const unassignSubject = async (teacherId: number, subjectId: number) => {
        await authFetch(`${API_URL}/api/teacher-subjects`, { method: 'DELETE', body: JSON.stringify({ teacher_id: teacherId, subject_id: subjectId }) });
        loadAll();
    };

    const assignSubject = async () => {
        await authFetch(`${API_URL}/api/teacher-subjects`, { method: 'POST', body: JSON.stringify({ teacher_id: Number(assignTeacher.teacher_id), subject_id: Number(assignTeacher.subject_id) }) });
        setAssignTeacher({ teacher_id: '', subject_id: '' });
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

    const bulkApprove = async () => {
        const ids = enrollments.map((e: any) => e.id);
        await authFetch(`${API_URL}/api/enrollments/bulk-approve`, { method: 'PATCH', body: JSON.stringify({ ids }) });
        loadAll();
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
        if (!fileInput.files?.[0]) return;
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        const res = await fetch(`${API_URL}/api/documents/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        alert(data.message || 'Uploaded');
        loadAll();
    };

    const approveLessonClick = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        loadAll();
    };

    const trashLesson = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/${id}/trash`, { method: 'PATCH' });
        loadAll();
    };

    const restoreLesson = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/${id}/restore`, { method: 'PATCH' });
        loadAll();
    };

    const deleteLesson = async (id: number) => {
        if (!confirm('Permanently delete this lesson?')) return;
        await fetch(`${API_URL}/api/lessons/${id}`, { method: 'DELETE' });
        loadAll();
    };

    const toggleLessonActive = async (id: number) => {
        await fetch(`${API_URL}/api/lessons/${id}/toggle-active`, { method: 'PATCH' });
        loadAll();
    };

    if (authLoading || !user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;

    const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
        { key: 'overview', icon: <BookOpen size={18}/>, label: 'Overview' },
        { key: 'lessons', icon: <Database size={18}/>, label: `Lessons (${pendingLessons.length + approvedLessons.length})` },
        { key: 'subjects', icon: <FileText size={18}/>, label: 'Subjects' },
        { key: 'teachers', icon: <Users size={18}/>, label: 'Teachers' },
        { key: 'enrollments', icon: <Bell size={18}/>, label: `Enrollments (${enrollments.length})` },
        { key: 'sources', icon: <Upload size={18}/>, label: 'Sources' },
        { key: 'prompts', icon: <Settings size={18}/>, label: 'Prompts' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900/80 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                    <div><h1 className="font-bold text-lg">Super Admin</h1><p className="text-xs text-slate-500">{user.email}</p></div>
                </div>
                <button onClick={() => { logout(); router.push('/login'); }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"><LogOut size={16}/> Logout</button>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <nav className="w-64 bg-slate-900/50 border-r border-white/5 min-h-[calc(100vh-65px)] p-4 space-y-1">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <main className="flex-1 p-8">
                    {tab === 'overview' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">System Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                {[
                                    { label: 'Subjects', value: subjects.length, color: 'indigo' },
                                    { label: 'Teachers', value: teachers.length, color: 'blue' },
                                    { label: 'Pending Lessons', value: pendingLessons.length, color: 'amber' },
                                    { label: 'Live Lessons', value: approvedLessons.length, color: 'emerald' },
                                ].map(s => (
                                    <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-2xl p-6`}>
                                        <p className="text-sm text-slate-400">{s.label}</p>
                                        <p className="text-3xl font-bold mt-2">{s.value}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Pending lessons quick view */}
                            <h3 className="text-lg font-bold mb-4">Pending Lessons ({pendingLessons.length})</h3>
                            <div className="space-y-2">
                                {pendingLessons.slice(0, 10).map((l: any) => (
                                    <div key={l.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div><p className="font-medium">{l.title_english}</p><p className="text-sm text-slate-500">{l.title_urdu}</p></div>
                                        <button onClick={() => approveLessonClick(l.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500 transition-colors">Approve</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'lessons' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Lesson Management</h2>
                            {/* Sub tabs */}
                            <div className="flex gap-3 mb-6">
                                {[
                                    { key: 'pending' as const, label: `Pending (${pendingLessons.length})`, color: 'amber' },
                                    { key: 'approved' as const, label: `Approved (${approvedLessons.length})`, color: 'emerald' },
                                    { key: 'trashed' as const, label: `Trashed (${trashedLessons.length})`, color: 'red' },
                                ].map(v => (
                                    <button key={v.key} onClick={() => setLessonView(v.key)}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${lessonView === v.key ? `bg-${v.color}-600 text-white` : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{v.label}</button>
                                ))}
                            </div>

                            {/* Pending Lessons */}
                            {lessonView === 'pending' && (
                                <div className="space-y-3">
                                    {pendingLessons.length === 0 ? <p className="text-slate-500 py-8 text-center">No pending lessons</p> : pendingLessons.map((l: any) => (
                                        <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 mr-4">
                                                    <p className="font-bold text-lg">{l.title_english}</p>
                                                    <p className="text-slate-400 mt-1" dir="rtl">{l.title_urdu}</p>
                                                    <p className="text-sm text-slate-500 mt-2">{l.objective?.substring(0, 200)}{l.objective?.length > 200 ? '...' : ''}</p>
                                                    <p className="text-xs text-slate-600 mt-2">Source: {l.source_document || 'N/A'} | Level: {l.level || 'N/A'}</p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => approveLessonClick(l.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500 flex items-center gap-1 transition-colors"><CheckCircle size={14}/> Approve</button>
                                                    <button onClick={() => trashLesson(l.id)} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 flex items-center gap-1 transition-colors"><Trash2 size={14}/> Trash</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Approved Lessons */}
                            {lessonView === 'approved' && (
                                <div className="space-y-3">
                                    {approvedLessons.length === 0 ? <p className="text-slate-500 py-8 text-center">No approved lessons</p> : approvedLessons.map((l: any) => (
                                        <div key={l.id} className={`border rounded-xl p-5 transition-colors ${l.is_active === false ? 'bg-slate-800/50 border-white/5 opacity-60' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 mr-4">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-lg">{l.title_english}</p>
                                                        {l.is_active === false && <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">Hidden</span>}
                                                    </div>
                                                    <p className="text-slate-400 mt-1" dir="rtl">{l.title_urdu}</p>
                                                    <p className="text-sm text-slate-500 mt-2">{l.objective?.substring(0, 150)}{l.objective?.length > 150 ? '...' : ''}</p>
                                                    <p className="text-xs text-slate-600 mt-2">Source: {l.source_document || 'N/A'} | Level: {l.level || 'N/A'}</p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => toggleLessonActive(l.id)} title={l.is_active === false ? 'Show' : 'Hide'} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors">{l.is_active === false ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
                                                    <button onClick={() => trashLesson(l.id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Trashed Lessons */}
                            {lessonView === 'trashed' && (
                                <div className="space-y-3">
                                    {trashedLessons.length === 0 ? <p className="text-slate-500 py-8 text-center">Trash is empty</p> : trashedLessons.map((l: any) => (
                                        <div key={l.id} className="bg-red-950/20 border border-red-500/10 rounded-xl p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 mr-4">
                                                    <p className="font-bold text-lg text-slate-400">{l.title_english}</p>
                                                    <p className="text-slate-500 mt-1" dir="rtl">{l.title_urdu}</p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => restoreLesson(l.id)} className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-600/30 flex items-center gap-1 transition-colors"><RotateCcw size={14}/> Restore</button>
                                                    <button onClick={() => deleteLesson(l.id)} className="px-4 py-2 bg-red-600 rounded-lg text-sm hover:bg-red-500 flex items-center gap-1 transition-colors"><Trash2 size={14}/> Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'subjects' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Manage Subjects</h2>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={18}/> New Subject</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input value={newSubject.name_english} onChange={e => setNewSubject({...newSubject, name_english: e.target.value})} placeholder="English Name" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                    <input value={newSubject.name_urdu} onChange={e => setNewSubject({...newSubject, name_urdu: e.target.value})} placeholder="اردو نام" dir="rtl" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                    <input value={newSubject.description} onChange={e => setNewSubject({...newSubject, description: e.target.value})} placeholder="Description" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                </div>
                                <button onClick={createSubject} disabled={!newSubject.name_english || !newSubject.name_urdu} className="mt-4 px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 transition-colors">Create Subject</button>
                            </div>
                            <div className="space-y-3">
                                {subjects.map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div><p className="font-bold">{s.name_english}</p><p className="text-sm text-slate-400">{s.name_urdu} — {s.lesson_count} lessons</p></div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">ID: {s.id}</span>
                                            <button onClick={() => setEditingSubject({...s})} className="p-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"><Pencil size={14}/></button>
                                            <button onClick={() => deleteSubject(s.id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Edit Subject Modal */}
                            {editingSubject && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingSubject(null)}>
                                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Edit Subject</h3><button onClick={() => setEditingSubject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                                        <div className="space-y-3">
                                            <input value={editingSubject.name_english} onChange={e => setEditingSubject({...editingSubject, name_english: e.target.value})} placeholder="English Name" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            <input value={editingSubject.name_urdu} onChange={e => setEditingSubject({...editingSubject, name_urdu: e.target.value})} placeholder="اردو نام" dir="rtl" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            <input value={editingSubject.description} onChange={e => setEditingSubject({...editingSubject, description: e.target.value})} placeholder="Description" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                        </div>
                                        <div className="flex gap-3 mt-5"><button onClick={updateSubject} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-colors">Save Changes</button><button onClick={() => setEditingSubject(null)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">Cancel</button></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'teachers' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Manage Teachers</h2>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <h3 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={18}/> Add Teacher</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input value={newTeacher.full_name} onChange={e => setNewTeacher({...newTeacher, full_name: e.target.value})} placeholder="Full Name" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                    <input value={newTeacher.email} onChange={e => setNewTeacher({...newTeacher, email: e.target.value})} placeholder="Email" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                    <input type="password" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} placeholder="Password" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                </div>
                                <button onClick={createTeacher} disabled={!newTeacher.email || !newTeacher.password || !newTeacher.full_name} className="mt-4 px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 transition-colors">Add Teacher</button>
                            </div>
                            {/* Assign to subject */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <h3 className="font-bold mb-4 flex items-center gap-2"><Link2 size={18}/> Assign Teacher → Subject</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select value={assignTeacher.teacher_id} onChange={e => setAssignTeacher({...assignTeacher, teacher_id: e.target.value})} className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none">
                                        <option value="">Select Teacher</option>
                                        {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                    </select>
                                    <select value={assignTeacher.subject_id} onChange={e => setAssignTeacher({...assignTeacher, subject_id: e.target.value})} className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none">
                                        <option value="">Select Subject</option>
                                        {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name_english}</option>)}
                                    </select>
                                </div>
                                <button onClick={assignSubject} disabled={!assignTeacher.teacher_id || !assignTeacher.subject_id} className="mt-4 px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors">Assign</button>
                            </div>
                            <div className="space-y-3">
                                {teachers.map((t: any) => (
                                    <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold">{t.full_name}</p>
                                                <p className="text-sm text-slate-400">{t.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setEditingTeacher({...t})} className="p-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"><Pencil size={14}/></button>
                                                <button onClick={() => deleteTeacher(t.id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">{t.subjects?.map((s: any) => (
                                            <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                                                {s.name}
                                                <button onClick={() => unassignSubject(t.id, s.id)} className="ml-1 text-blue-400 hover:text-red-400 transition-colors"><X size={12}/></button>
                                            </span>
                                        ))}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Edit Teacher Modal */}
                            {editingTeacher && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingTeacher(null)}>
                                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Edit Teacher</h3><button onClick={() => setEditingTeacher(null)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                                        <div className="space-y-3">
                                            <input value={editingTeacher.full_name} onChange={e => setEditingTeacher({...editingTeacher, full_name: e.target.value})} placeholder="Full Name" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                            <input value={editingTeacher.email} onChange={e => setEditingTeacher({...editingTeacher, email: e.target.value})} placeholder="Email" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"/>
                                        </div>
                                        <div className="flex gap-3 mt-5"><button onClick={updateTeacher} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-colors">Save Changes</button><button onClick={() => setEditingTeacher(null)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">Cancel</button></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'enrollments' && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">Enrollment Requests ({enrollments.length})</h2>
                                {enrollments.length > 0 && <button onClick={bulkApprove} className="px-6 py-3 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition-colors">✅ Approve All</button>}
                            </div>
                            {enrollments.length === 0 ? <p className="text-slate-500">No pending requests</p> : (
                                <div className="space-y-3">
                                    {enrollments.map((e: any) => (
                                        <div key={e.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                                            <div>
                                                <p className="font-bold">{e.student_name}</p>
                                                <p className="text-sm text-slate-400">{e.student_email} → {e.subject_name}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => approveEnrollment(e.id)} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm hover:bg-emerald-500"><CheckCircle size={16}/></button>
                                                <button onClick={() => denyEnrollment(e.id)} className="px-4 py-2 bg-red-600 rounded-lg text-sm hover:bg-red-500"><XCircle size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'sources' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Upload Source Document</h2>
                            <form onSubmit={handleUpload} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <select value={uploadSubjectId} onChange={e => setUploadSubjectId(e.target.value)} className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none">
                                        <option value="">Link to Subject (optional)</option>
                                        {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name_english}</option>)}
                                    </select>
                                    <input type="file" accept=".pdf" className="px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none file:bg-indigo-600 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-1 file:mr-3"/>
                                </div>
                                <button type="submit" className="px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2"><Upload size={18}/> Upload & Process</button>
                            </form>
                        </div>
                    )}

                    {tab === 'prompts' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Global Prompts</h2>
                            <p className="text-slate-400 mb-4">Manage extraction and tutor prompts. Subject-level overrides can be set by teachers.</p>
                            <PromptsEditor authFetch={authFetch} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function PromptsEditor({ authFetch }: { authFetch: any }) {
    const [prompts, setPrompts] = useState<any[]>([]);
    const [editing, setEditing] = useState<Record<string, string>>({});
    
    useEffect(() => {
        fetch(`${API_URL}/api/prompts`).then(r => r.json()).then(d => {
            setPrompts(d.data || []);
            const map: Record<string, string> = {};
            (d.data || []).forEach((p: any) => { map[p.prompt_name] = p.prompt_text; });
            setEditing(map);
        });
    }, []);

    const savePrompt = async (name: string) => {
        await authFetch(`${API_URL}/api/prompts`, { method: 'PUT', body: JSON.stringify({ prompt_name: name, prompt_text: editing[name] }) });
        alert(`Prompt "${name}" saved`);
    };

    return (
        <div className="space-y-6">
            {prompts.map((p: any) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="font-bold text-indigo-400 mb-3">{p.prompt_name}</h3>
                    <textarea value={editing[p.prompt_name] || ''} onChange={e => setEditing({...editing, [p.prompt_name]: e.target.value})}
                        className="w-full h-48 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-sm font-mono outline-none focus:border-indigo-500 resize-y"/>
                    <button onClick={() => savePrompt(p.prompt_name)} className="mt-3 px-6 py-2 bg-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-500 transition-colors">Save</button>
                </div>
            ))}
        </div>
    );
}
