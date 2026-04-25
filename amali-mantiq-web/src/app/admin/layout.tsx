"use client";

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Home, FileText, CheckCircle, Database, Settings, Trash2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch(`${API_URL}/api/lessons/pending`);
                const json = await res.json();
                setPendingCount(json.data?.length || 0);
            } catch {}
        };
        fetchCount();
        // Poll every 10 seconds to catch new lessons streaming in
        const interval = setInterval(fetchCount, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
            <aside className="w-[280px] bg-slate-900 text-white flex flex-col shrink-0">
                <div className="p-6 text-xl flex items-center gap-3 border-b border-white/5">
                    <Brain className="text-indigo-400" size={28} />
                    <h2 className="font-bold text-2xl tracking-tight">Course<span className="text-slate-400">AI</span></h2>
                </div>
                <nav className="flex-1 py-6 flex flex-col gap-1">
                    <NavItem href="/admin/overview" icon={<Home size={20}/>} label="Overview" pathname={pathname} />
                    <NavItem href="/admin/sources" icon={<FileText size={20}/>} label="Source Documents" pathname={pathname} />
                    <NavItem href="/admin" icon={<CheckCircle size={20}/>} label="Pending Review" badge={pendingCount > 0 ? String(pendingCount) : undefined} pathname={pathname} exact={true} />
                    <NavItem href="/admin/live-db" icon={<Database size={20}/>} label="Live Content DB" pathname={pathname} />
                    <NavItem href="/admin/trash" icon={<Trash2 size={20}/>} label="Trash" pathname={pathname} />
                    <div className="my-4 border-t border-white/5"></div>
                    <NavItem href="/admin/prompts" icon={<Settings size={20}/>} label="Agent Prompts" pathname={pathname} />
                </nav>
                <div className="p-6 border-t border-white/5 flex items-center gap-4 bg-slate-950/30">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm shadow-md">T</div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm">Lead Reviewer</span>
                        <span className="text-xs text-slate-400">SME Teacher</span>
                    </div>
                </div>
            </aside>
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-100/50">
                {children}
            </main>
        </div>
    );
}

function NavItem({ href, icon, label, badge, pathname, exact }: { href: string, icon: React.ReactNode, label: string, badge?: string, pathname: string, exact?: boolean }) {
    const isActive = exact ? pathname === href : pathname.startsWith(href) && (href !== '/admin' || pathname === '/admin');
    
    return (
        <Link href={href} className={`flex items-center px-6 py-3 text-sm transition-all relative ${isActive ? 'text-white bg-indigo-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500 rounded-r-md"></div>}
            <span className={`w-5 h-5 flex items-center justify-center mr-4 ${isActive ? 'text-indigo-400' : ''}`}>{icon}</span>
            <span className="flex-1 font-medium">{label}</span>
            {badge && <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm">{badge}</span>}
        </Link>
    );
}
