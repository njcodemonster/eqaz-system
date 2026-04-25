"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';

interface Lesson {
    id: number;
    title_english: string;
    title_urdu: string;
    source_document: string;
    is_approved: boolean;
    created_at: string;
}

export default function TrashPage() {
    const [trashedLessons, setTrashedLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchTrashed();
    }, []);

    const fetchTrashed = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/lessons/trashed`);
            const json = await res.json();
            if (json.data) {
                setTrashedLessons(json.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (id: number) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/lessons/${id}/restore`, { method: 'PATCH' });
            if (res.ok) {
                setTrashedLessons(trashedLessons.filter(l => l.id !== id));
            }
        } catch (err) {
            alert("Error restoring lesson.");
        }
    };

    const handlePermanentDelete = async (id: number) => {
        if (!confirm("This will PERMANENTLY delete this lesson. This cannot be undone. Continue?")) return;
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/lessons/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTrashedLessons(trashedLessons.filter(l => l.id !== id));
            }
        } catch (err) {
            alert("Error deleting lesson.");
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;
    }

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Trash</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Recover or permanently delete trashed lessons.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto">
                    {trashedLessons.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Trash2 size={48} className="mb-4 opacity-30" />
                            <h2 className="text-xl font-semibold mb-1">Trash is Empty</h2>
                            <p className="text-sm">No lessons have been trashed.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 text-sm">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
                                <p><strong>Warning:</strong> Permanently deleting a lesson cannot be undone. Use "Restore" to bring items back to their original state.</p>
                            </div>

                            {trashedLessons.map(lesson => (
                                <div key={lesson.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center">
                                            <Trash2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">{lesson.title_english}</p>
                                            <p className="text-sm text-slate-500 font-serif" dir="rtl">{lesson.title_urdu}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {lesson.is_approved ? "Was Published" : "Was Pending"} · From: {lesson.source_document || "Manual"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleRestore(lesson.id)}
                                            className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center gap-2 text-sm font-medium transition-colors"
                                        >
                                            <RotateCcw size={16} /> Restore
                                        </button>
                                        <button 
                                            onClick={() => handlePermanentDelete(lesson.id)}
                                            className="px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2 text-sm font-medium transition-colors"
                                        >
                                            <XCircle size={16} /> Delete Forever
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
