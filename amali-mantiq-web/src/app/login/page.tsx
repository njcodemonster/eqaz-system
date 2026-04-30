"use client";
import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Eye, EyeOff, BookOpen } from 'lucide-react';

export default function LoginPage() {
    const { login, user } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            if (user.role === 'super_admin') router.replace('/admin');
            else if (user.role === 'teacher') router.replace('/teacher');
            else router.replace('/student');
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password);
        setLoading(false);
        if (result.success) {
            // useEffect will handle redirect
        } else {
            setError(result.error || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-purple-950/20" />
            
            <div className="relative w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
                        <BookOpen size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Learning System</h1>
                    <p className="text-slate-400 mt-2">Dars-e-Nizami Digital Platform</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white text-center">Sign In</h2>
                    
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">{error}</div>
                    )}
                    
                    <div>
                        <label className="text-sm text-slate-400 block mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                            placeholder="your@email.com"
                        />
                    </div>
                    
                    <div>
                        <label className="text-sm text-slate-400 block mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors pr-12"
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><LogIn size={18}/> Sign In</>}
                    </button>
                    
                    <p className="text-center text-sm text-slate-500">
                        Student? <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">Create an account</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
