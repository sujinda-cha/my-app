"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

// สร้างตัวโหลด agent แบบ singleton นอกคอมโพเนนต์ ป้องกันโหลดซ้ำ
const fpPromise = FingerprintJS.load();

export default function Home() {
    const [url, setUrl] = useState("");
    const [visitorId, setVisitorId] = useState<string>("");

    // ดึง fingerprint (ทำครั้งเดียว)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const fp = await fpPromise;
                const result = await fp.get();
                if (mounted) setVisitorId(result.visitorId);
            } catch (e) {
                console.error("FP error:", e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // คำนวณ default login URL จาก visitorId ทุกครั้งที่ visitorId เปลี่ยน
    const defaultLogin = useMemo(() => {
        const base = process.env.NEXT_PUBLIC_API ?? "";
        const clientId = process.env.NEXT_PUBLIC_OKTA_CLIENT_ID ?? "";
        // ถ้ายังไม่มี visitorId ให้เว้นว่างไว้ก่อน
        const u = new URL(`${base}/v1/authentication/login`);
        if (visitorId) u.searchParams.set("fingerprint", visitorId);
        if (clientId) u.searchParams.set("clientId", clientId);
        return u.toString();
    }, [visitorId]);

    // URL สุดท้ายที่ใช้ (ถ้าผู้ใช้กรอกเองให้ใช้ค่านั้น, ไม่งั้นใช้ default)
    const finalUrl = useMemo(() => {
        const v = url.trim();
        if (!v) return defaultLogin;

        try {
            const u = new URL(
                v,
                typeof window !== "undefined" ? window.location.origin : "http://localhost"
            );
            return u.toString();
        } catch {
            return defaultLogin;
        }
    }, [url, defaultLogin]);

    // Auto-redirect เมื่อมี ?trig=true และพร้อม visitorId แล้ว
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const shouldTrig = params.get("trig") === "true";
        if (shouldTrig && visitorId) {
            window.location.assign(finalUrl);
        }
    }, [visitorId, finalUrl]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
    }, []);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") login();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const login = useCallback(() => {
        // ป้องกันยิงไปตอน fingerprint ยังไม่พร้อม
        if (!visitorId) {
            console.warn("Fingerprint not ready yet");
            return;
        }
        window.location.assign(finalUrl);
    }, [finalUrl, visitorId]);

    return (
        <div className="p-4">
            <div className="flex items-center gap-2">
                <label htmlFor="api-url" className="w-24">
                    API URL:
                </label>
                <input
                    id="api-url"
                    type="text"
                    value={url}
                    onChange={handleChange}
                    onKeyDown={onKeyDown}
                    placeholder={defaultLogin}
                    className="border border-amber-600 rounded-lg h-8 w-full px-2 outline-none"
                />
            </div>

            <button
                className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition disabled:opacity-50"
                onClick={login}
                disabled={!visitorId}
                title={!visitorId ? "Waiting for fingerprint..." : ""}
            >
                Login with Okta
            </button>

            <p className="mt-2 text-xs text-gray-500">
                Visitor ID: <span className="font-mono">{visitorId || "(loading...)"}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
                Will redirect to:&nbsp;
                <span className="font-mono break-all">{finalUrl}</span>
            </p>
        </div>
    );
}