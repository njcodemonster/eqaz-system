"use client";
import { API_URL } from '@/lib/api';

import React, { useState } from 'react';
import { FileUp, FileText, CheckCircle2, AlertCircle, RefreshCw, FileCode2, Clock } from 'lucide-react';

export default function SourceDocumentsPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{type: 'success' | 'error' | 'processing', message: string, details?: string} | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setUploadStatus(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setUploadStatus(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_URL}/api/documents/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "Failed to upload document");
            }

            const data = await res.json();
            setUploadStatus({ 
                type: 'processing', 
                message: data.message,
                details: `Total characters extracted: ${data.total_characters?.toLocaleString()}. Estimated ${data.estimated_chunks} text chunks queued for Gemini processing.`
            });
            setFile(null);
        } catch (error: any) {
            setUploadStatus({ type: 'error', message: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <header className="h-[88px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Source Documents</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Upload Classical texts (PDF) to automatically trigger Gemini ingestion.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Upload Section */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center">
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex justify-center items-center mb-4">
                            <FileUp size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 mb-2">Upload New Source Text</h2>
                        <p className="text-slate-500 mb-6 text-center max-w-lg">
                            Upload a PDF of classical philosophical text. The system will extract the full text, split it into manageable chunks, and process each chunk through Gemini in the background. Lessons will appear in <strong>Pending Review</strong> as they are generated.
                        </p>
                        
                        <div className="w-full max-w-md">
                            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 hover:bg-slate-50 bg-white'}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileText className={`w-8 h-8 mb-3 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    <p className="text-sm text-slate-500 font-medium">
                                        {file ? file.name : "Click to select a PDF document"}
                                    </p>
                                    {file && <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                                </div>
                                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                            </label>
                        </div>
                        
                        <button 
                            onClick={handleUpload}
                            disabled={!file || isUploading}
                            className={`mt-6 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md ${
                                !file 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                : isUploading
                                ? 'bg-indigo-400 text-white cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/30'
                            }`}
                        >
                            {isUploading ? <RefreshCw className="animate-spin" size={20}/> : <FileCode2 size={20}/>}
                            {isUploading ? "Uploading & Extracting Text..." : "Process Document"}
                        </button>
                    </div>

                    {/* Status Messages */}
                    {uploadStatus && uploadStatus.type === 'processing' && (
                        <div className="p-6 rounded-xl border bg-blue-50 border-blue-200 text-blue-800 flex items-start gap-4">
                            <Clock className="shrink-0 text-blue-500 animate-pulse" size={24}/>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Background Processing Started</h3>
                                <p className="opacity-90 mb-3">{uploadStatus.message}</p>
                                {uploadStatus.details && (
                                    <div className="p-4 bg-white/60 rounded-lg border border-blue-200/50 font-medium text-sm">
                                        {uploadStatus.details}
                                    </div>
                                )}
                                <p className="text-sm mt-3 opacity-70">
                                    💡 You can navigate to <strong>Pending Review</strong> and refresh to see new lessons appearing as they are generated.
                                </p>
                            </div>
                        </div>
                    )}

                    {uploadStatus && uploadStatus.type === 'error' && (
                        <div className="p-6 rounded-xl border bg-red-50 border-red-200 text-red-800 flex items-start gap-4">
                            <AlertCircle className="shrink-0 text-red-500" size={24}/>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Upload Failed</h3>
                                <p className="opacity-90">{uploadStatus.message}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
