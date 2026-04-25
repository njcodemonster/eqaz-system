"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { 
    Wand2, RefreshCw, ChevronRight, CloudUpload, CheckCircle2, Trash2
} from 'lucide-react';

interface PendingLesson {
    id: number;
    title_english: string;
    title_urdu: string;
    objective: string;
    definition_classic: string;
    definition_modern: string;
    source_document: string;
}

export default function PendingReviewPage() {
    const [pendingLessons, setPendingLessons] = useState<PendingLesson[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        fetchPendingLessons();
    }, []);

    const fetchPendingLessons = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/lessons/pending`);
            const json = await res.json();
            if (json.data) {
                setPendingLessons(json.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        if (!currentLesson) return;
        setIsSyncing(true);
        try {
            const res = await fetch(`${API_URL}/api/lessons/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(currentLesson)
            });
            if (res.ok) {
                removeCurrentAndAdvance();
            }
        } catch(err) {
            alert("Network Error: Make sure your Python backend is running!");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleTrash = async () => {
        if (!currentLesson) return;
        if (!confirm("Move this draft to trash?")) return;
        try {
            const res = await fetch(`${API_URL}/api/lessons/${currentLesson.id}/trash`, { method: 'PATCH' });
            if (res.ok) {
                removeCurrentAndAdvance();
            }
        } catch (err) {
            alert("Error trashing lesson.");
        }
    };

    const removeCurrentAndAdvance = () => {
        const updated = pendingLessons.filter((_, idx) => idx !== currentIndex);
        setPendingLessons(updated);
        if (currentIndex >= updated.length) {
            setCurrentIndex(Math.max(0, updated.length - 1));
        }
    };

    const handleSkip = () => {
        if (currentIndex < pendingLessons.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;
    }

    if (pendingLessons.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="text-emerald-500 mb-4" size={48}/>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">You're All Caught Up!</h2>
                <p className="text-slate-500 max-w-md">There are no pending lessons to review. Upload more PDFs in Source Documents to generate new drafts.</p>
            </div>
        );
    }

    const currentLesson = pendingLessons[currentIndex];

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Review Draft {currentIndex + 1} of {pendingLessons.length}</h1>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                        From <strong>{currentLesson.source_document || "PDF Document"}</strong>
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleTrash} className="px-4 py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2 text-sm font-medium transition-colors">
                        <Trash2 size={16} /> Trash
                    </button>
                    <button onClick={handlePrev} disabled={currentIndex === 0} className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors text-slate-700 disabled:opacity-40">
                        <ChevronRight size={16} className="rotate-180" /> Previous
                    </button>
                    <button onClick={handleSkip} disabled={currentIndex >= pendingLessons.length - 1} className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors text-slate-700 disabled:opacity-40">
                        Skip <ChevronRight size={16} />
                    </button>
                    <button onClick={handleSync} disabled={isSyncing} className={`px-6 py-2.5 rounded-lg text-white flex items-center gap-2 text-sm font-medium transition-all shadow-md active:scale-95 ${isSyncing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/25'}`}>
                        {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <CloudUpload size={16} />} 
                        {isSyncing ? "Publishing..." : "Approve & Publish"}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex p-6 gap-6 overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 bg-indigo-50/50 flex justify-between items-center">
                        <h3 className="font-semibold flex items-center gap-2 text-indigo-700">
                            <Wand2 size={18}/> AI Generated Content
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 space-y-6">
                        {/* Title & Objective */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Title & Objective</span>
                            </div>
                            <div className="p-6 outline-none" contentEditable suppressContentEditableWarning dir="rtl" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                <strong className="text-indigo-600 font-bold ml-2">عنوان:</strong> {currentLesson.title_urdu} ({currentLesson.title_english})<br/><br/>
                                <strong className="text-indigo-600 font-bold ml-2">ہدف:</strong> {currentLesson.objective}
                            </div>
                        </div>

                        {/* Classical Definition */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Classical Definition</span>
                            </div>
                            <div className="p-6 text-xl leading-[2.2] outline-none" contentEditable suppressContentEditableWarning dir="rtl" style={{fontFamily: "'Noto Nastaliq Urdu', serif"}}>
                                {currentLesson.definition_classic}
                            </div>
                        </div>

                        {/* Modern Equivalent */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Modern Equivalent</span>
                            </div>
                            <div className="p-6 text-lg leading-relaxed outline-none" contentEditable suppressContentEditableWarning>
                                {currentLesson.definition_modern}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
