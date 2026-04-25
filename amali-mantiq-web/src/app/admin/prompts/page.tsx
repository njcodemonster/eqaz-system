"use client";
import { API_URL } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, CheckCircle2, AlertCircle, Wand2, Bot, FileCode2 } from 'lucide-react';

interface PromptConfig {
    id: number;
    prompt_name: string;
    prompt_text: string;
}

const PROMPT_LABELS: Record<string, {title: string, description: string, icon: React.ReactNode}> = {
    extraction: {
        title: "PDF Extraction Prompt",
        description: "Controls how Gemini breaks down uploaded PDFs into structured lesson objects. This prompt is injected into every chunk during background processing.",
        icon: <FileCode2 size={20} className="text-indigo-500" />
    },
    tutor: {
        title: "AI Tutor System Prompt",
        description: "Controls the personality and behavior of the student-facing AI Tutor chatbot. This prompt is prepended to every student question.",
        icon: <Bot size={20} className="text-purple-500" />
    }
};

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<PromptConfig[]>([]);
    const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingName, setSavingName] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<{name: string, type: 'success' | 'error', message: string} | null>(null);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/prompts`);
            const json = await res.json();
            if (json.data) {
                setPrompts(json.data);
                const texts: Record<string, string> = {};
                json.data.forEach((p: PromptConfig) => { texts[p.prompt_name] = p.prompt_text; });
                setEditedTexts(texts);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (promptName: string) => {
        setSavingName(promptName);
        setSaveStatus(null);
        try {
            const res = await fetch(`${API_URL}/api/prompts`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt_name: promptName, prompt_text: editedTexts[promptName] })
            });
            if (res.ok) {
                setSaveStatus({ name: promptName, type: 'success', message: 'Saved! Changes take effect on the next operation.' });
            } else {
                setSaveStatus({ name: promptName, type: 'error', message: 'Failed to save.' });
            }
        } catch (err) {
            setSaveStatus({ name: promptName, type: 'error', message: 'Network error.' });
        } finally {
            setSavingName(null);
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;
    }

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Agent Prompts Configuration</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Control exactly how the AI agents behave across the platform.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Info Card */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex gap-4 items-start">
                        <Wand2 className="text-indigo-500 shrink-0 mt-0.5" size={22} />
                        <div>
                            <h3 className="font-bold text-indigo-800 mb-1">How Prompts Work</h3>
                            <p className="text-sm text-indigo-700/80 leading-relaxed">
                                Each prompt below controls a different AI agent in the system. 
                                The <strong>Extraction Prompt</strong> is used when processing uploaded PDFs into lessons. 
                                The <strong>Tutor Prompt</strong> defines how the student-facing AI chatbot responds.
                                <strong> Changes are saved to the database and take effect immediately.</strong>
                            </p>
                        </div>
                    </div>

                    {/* Prompt Editors */}
                    {prompts.map(prompt => {
                        const meta = PROMPT_LABELS[prompt.prompt_name] || { title: prompt.prompt_name, description: "System prompt.", icon: <Settings size={20}/> };
                        const isSaving = savingName === prompt.prompt_name;
                        
                        return (
                            <div key={prompt.prompt_name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {meta.icon}
                                        <div>
                                            <h2 className="font-semibold text-slate-700">{meta.title}</h2>
                                            <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleSave(prompt.prompt_name)}
                                        disabled={isSaving}
                                        className={`px-5 py-2 rounded-lg text-white flex items-center gap-2 text-sm font-medium transition-all shadow-sm ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
                                    >
                                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} 
                                        {isSaving ? "Saving..." : "Save"}
                                    </button>
                                </div>
                                <div className="p-6">
                                    <textarea 
                                        value={editedTexts[prompt.prompt_name] || ""}
                                        onChange={e => setEditedTexts(prev => ({...prev, [prompt.prompt_name]: e.target.value}))}
                                        rows={10}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm leading-relaxed font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all resize-y shadow-inner"
                                    />
                                </div>
                                {saveStatus && saveStatus.name === prompt.prompt_name && (
                                    <div className={`mx-6 mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${saveStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        {saveStatus.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                                        {saveStatus.message}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Required Keys Reminder */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                        <strong>Extraction Prompt Note:</strong> The system always requires the JSON output to include these keys: 
                        <code className="bg-white px-1 py-0.5 rounded text-indigo-600 mx-1">title_urdu</code>
                        <code className="bg-white px-1 py-0.5 rounded text-indigo-600 mx-1">title_english</code>
                        <code className="bg-white px-1 py-0.5 rounded text-indigo-600 mx-1">objective</code>
                        <code className="bg-white px-1 py-0.5 rounded text-indigo-600 mx-1">definition_classic</code>
                        <code className="bg-white px-1 py-0.5 rounded text-indigo-600 mx-1">definition_modern</code>
                    </div>
                </div>
            </div>
        </>
    );
}
