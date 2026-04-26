"use client";
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) { router.replace('/login'); return; }
        if (user.role === 'super_admin') router.replace('/admin');
        else if (user.role === 'teacher') router.replace('/teacher');
        else router.replace('/student');
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center">
                <BookOpen size={48} className="text-indigo-500 mx-auto mb-4" />
                <RefreshCw size={24} className="text-indigo-400 animate-spin mx-auto" />
            </div>
        </div>
    );
}
