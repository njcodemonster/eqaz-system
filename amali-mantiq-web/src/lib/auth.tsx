"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from './api';

interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'super_admin' | 'teacher' | 'student';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('eqaz_token');
        const savedUser = localStorage.getItem('eqaz_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('eqaz_token', data.token);
                localStorage.setItem('eqaz_user', JSON.stringify(data.user));
                return { success: true };
            }
            return { success: false, error: data.detail || 'Login failed' };
        } catch {
            return { success: false, error: 'Network error' };
        }
    };

    const signup = async (email: string, password: string, fullName: string) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, full_name: fullName })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('eqaz_token', data.token);
                localStorage.setItem('eqaz_user', JSON.stringify(data.user));
                return { success: true };
            }
            return { success: false, error: data.detail || 'Signup failed' };
        } catch {
            return { success: false, error: 'Network error' };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('eqaz_token');
        localStorage.removeItem('eqaz_user');
    };

    const authFetch = async (url: string, options: RequestInit = {}) => {
        const headers = new Headers(options.headers || {});
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
        return fetch(url, { ...options, headers });
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
