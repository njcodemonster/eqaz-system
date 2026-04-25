"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { Database, Search, Eye, EyeOff, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Lesson {
    id: number;
    title_english: string;
    title_urdu: string;
    objective: string;
    source_document: string;
    is_approved: boolean;
    is_active: boolean;
    created_at: string;
}

export default function LiveContentDbPage() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchLessons();
    }, []);

    const fetchLessons = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/lessons/all`);
            const json = await res.json();
            if (json.data) {
                setLessons(json.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (id: number) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/lessons/${id}/toggle-active`, { method: 'PATCH' });
            if (res.ok) {
                const data = await res.json();
                setLessons(lessons.map(l => l.id === id ? {...l, is_active: data.is_active} : l));
            }
        } catch (err) {
            alert("Error toggling lesson visibility.");
        }
    };

    const handleTrash = async (id: number) => {
        if (!confirm("Move this lesson to trash? Students will no longer see it.")) return;
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/lessons/${id}/trash`, { method: 'PATCH' });
            if (res.ok) {
                setLessons(lessons.filter(l => l.id !== id));
            }
        } catch (err) {
            alert("Error trashing lesson.");
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;
    }

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Live Content Database</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage published content. Disable to hide from students, or trash to remove.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 items-center px-3 w-64 shadow-inner">
                        <Search className="text-slate-400" size={16} />
                        <input type="text" placeholder="Search lessons..." className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm ml-2 w-full py-1.5" />
                    </div>
                    <button onClick={fetchLessons} className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors text-slate-700">
                        <RefreshCw size={16}/> Refresh
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                    <th className="py-4 px-6">ID</th>
                                    <th className="py-4 px-6">Topic (EN / UR)</th>
                                    <th className="py-4 px-6">Source</th>
                                    <th className="py-4 px-6">Visibility</th>
                                    <th className="py-4 px-6">Date</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lessons.map(lesson => (
                                    <tr key={lesson.id} className={`hover:bg-slate-50/50 transition-colors group ${!lesson.is_active ? 'opacity-50' : ''}`}>
                                        <td className="py-4 px-6 text-slate-400 text-sm font-mono">#{lesson.id}</td>
                                        <td className="py-4 px-6">
                                            <div className="font-semibold text-slate-800">{lesson.title_english}</div>
                                            <div className="text-sm text-slate-500 font-serif" dir="rtl">{lesson.title_urdu}</div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
                                                <Database size={12}/> {lesson.source_document || "Manual"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {lesson.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wide bg-emerald-50 px-2 py-1 rounded">
                                                    <Eye size={14}/> Visible
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wide bg-slate-100 px-2 py-1 rounded">
                                                    <EyeOff size={14}/> Hidden
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-500">
                                            {new Date(lesson.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleToggleActive(lesson.id)} 
                                                    className={`p-1.5 rounded transition-colors ${lesson.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                    title={lesson.is_active ? "Disable (hide from students)" : "Enable (show to students)"}
                                                >
                                                    {lesson.is_active ? <EyeOff size={16}/> : <Eye size={16}/>}
                                                </button>
                                                <button onClick={() => handleTrash(lesson.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Move to trash">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {lessons.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-500">
                                            No published content available. Approve drafts from Pending Review.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
