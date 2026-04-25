"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, CheckCircle2, FileText, Database, Brain, RefreshCw, TrendingUp, Layers, Trash2 } from 'lucide-react';

interface Stats {
    published: number;
    pending: number;
    total: number;
}

interface Lesson {
    id: number;
    title_english: string;
    title_urdu: string;
    source_document: string;
    is_approved: boolean;
    created_at: string;
}

export default function OverviewPage() {
    const [stats, setStats] = useState<Stats>({ published: 0, pending: 0, total: 0 });
    const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [backendStatus, setBackendStatus] = useState<{ gemini: boolean; db: boolean } | null>(null);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [publishedRes, pendingRes, statusRes] = await Promise.all([
                fetch(`${API_URL}/api/lessons`),
                fetch(`${API_URL}/api/lessons/pending`),
                fetch(`${API_URL}/`)
            ]);

            const publishedData = await publishedRes.json();
            const pendingData = await pendingRes.json();
            const statusData = await statusRes.json();

            const pubCount = publishedData.data?.length || 0;
            const penCount = pendingData.data?.length || 0;

            setStats({ published: pubCount, pending: penCount, total: pubCount + penCount });
            
            // Combine and sort by most recent, take top 5
            const all = [...(publishedData.data || []), ...(pendingData.data || [])];
            all.sort((a: Lesson, b: Lesson) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setRecentLessons(all.slice(0, 6));

            setBackendStatus({
                gemini: statusData.gemini_ready || false,
                db: statusData.db_connected || false
            });
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;
    }

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        System health and content metrics at a glance.
                    </p>
                </div>
                <button onClick={fetchAll} className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors text-slate-700">
                    <RefreshCw size={16} /> Refresh
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* System Status Strip */}
                    <div className="flex gap-4">
                        <StatusPill label="Supabase DB" active={backendStatus?.db ?? false} />
                        <StatusPill label="Gemini AI" active={backendStatus?.gemini ?? false} />
                        <StatusPill label="FastAPI Server" active={true} />
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard 
                            icon={<CheckCircle2 size={24}/>} 
                            label="Published Lessons" 
                            value={stats.published} 
                            color="emerald"
                            subtitle="Live to students"
                        />
                        <MetricCard 
                            icon={<Clock size={24}/>} 
                            label="Pending Review" 
                            value={stats.pending} 
                            color="amber"
                            subtitle="Awaiting teacher approval"
                        />
                        <MetricCard 
                            icon={<Layers size={24}/>} 
                            label="Total Content" 
                            value={stats.total} 
                            color="indigo"
                            subtitle="All lessons in system"
                        />
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                                <TrendingUp size={18} className="text-indigo-500"/> Recent Activity
                            </h2>
                            <span className="text-xs text-slate-400">Last {recentLessons.length} entries</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {recentLessons.length === 0 && (
                                <div className="p-8 text-center text-slate-400">
                                    No lessons yet. Upload a PDF in Source Documents to get started.
                                </div>
                            )}
                            {recentLessons.map(lesson => (
                                <div key={lesson.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lesson.is_approved ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                            {lesson.is_approved ? <CheckCircle2 size={20}/> : <Clock size={20}/>}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{lesson.title_english}</p>
                                            <p className="text-xs text-slate-400 font-serif" dir="rtl">{lesson.title_urdu}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-medium flex items-center gap-1">
                                            <FileText size={12}/> {lesson.source_document || "Manual"}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(lesson.created_at).toLocaleDateString()}
                                        </span>
                                        <button 
                                            onClick={async () => {
                                                await fetch(`http://127.0.0.1:8000/api/lessons/${lesson.id}/trash`, { method: 'PATCH' });
                                                setRecentLessons(prev => prev.filter(l => l.id !== lesson.id));
                                                setStats(prev => ({
                                                    ...prev,
                                                    total: prev.total - 1,
                                                    ...(lesson.is_approved ? { published: prev.published - 1 } : { pending: prev.pending - 1 })
                                                }));
                                            }}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                            title="Move to trash"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function MetricCard({ icon, label, value, color, subtitle }: { icon: React.ReactNode, label: string, value: number, color: string, subtitle: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    };
    const iconBg: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-600',
        amber: 'bg-amber-100 text-amber-600',
        indigo: 'bg-indigo-100 text-indigo-600',
    };

    return (
        <div className={`p-6 rounded-2xl border ${colorMap[color]} flex items-start justify-between`}>
            <div>
                <p className="text-sm font-medium opacity-80 mb-1">{label}</p>
                <p className="text-4xl font-bold tracking-tight">{value}</p>
                <p className="text-xs opacity-60 mt-1">{subtitle}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
                {icon}
            </div>
        </div>
    );
}

function StatusPill({ label, active }: { label: string, active: boolean }) {
    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            {label}: {active ? "Online" : "Offline"}
        </div>
    );
}
