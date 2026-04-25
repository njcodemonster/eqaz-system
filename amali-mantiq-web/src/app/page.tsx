import Link from 'next/link';
import { ArrowRight, BrainCircuit, GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans p-6 relative overflow-hidden">
        {/* Background shapes */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl text-center space-y-12">
            <div>
                <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium tracking-widest uppercase mb-6">
                    Mantiq Project Initialized
                </span>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
                    Amali Mantiq <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                        Platform Preview
                    </span>
                </h1>
                <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto font-light">
                    Select an application module below to preview the modern Next.js development build locally.
                </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
                <Link href="/admin" className="group p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all text-left flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-2">Editor CRM (Teacher)</h2>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">Enter the Human-in-the-Loop review dashboard mapped for Supabase + LLM.</p>
                        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium group-hover:gap-3 transition-all">
                            Enter Dashboard <ArrowRight size={16} />
                        </div>
                    </div>
                </Link>

                <Link href="/student" className="group p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all text-left flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-2">Student App (Public)</h2>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">Enter the high-performance public learning interface for verified content.</p>
                        <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium group-hover:gap-3 transition-all">
                            Enter Portal <ArrowRight size={16} />
                        </div>
                    </div>
                </Link>
            </div>
      </div>
    </div>
  );
}
