"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "exchanging" | "calling-api" | "done" | "error";

const TOKEN_PLACEHOLDER = "•••"; // don’t leak the whole token in the UI

// Top-level page component: provides the Suspense boundary
export default function CallbackPage() {
    return (
        <Suspense fallback={<LoadingUI label="Logging in..." />}>
            <CallbackInner />
        </Suspense>
    );
}

function CallbackInner() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [idToken, setIdToken] = useState<string | null>(null);
    const [ac, setAc] = useState<string | null>(null);
    const [re, setRe] = useState<string | null>(null);

    // Optional: support ?token=... in the URL to show something immediately
    const tokenFromQuery = searchParams.get("token");
    const at = searchParams.get("at");
    const rt = searchParams.get("rt");
    useEffect(() => {
        if (tokenFromQuery) setIdToken(tokenFromQuery);
    }, [tokenFromQuery]);
    useEffect(() => {
        if (at) setAc(at);
    }, [at]);
    useEffect(() => {
        if (rt) setRe(rt);
    }, [rt]);

    // Read the authorization code once
    const code = useMemo(() => searchParams.get("code"), [searchParams]);

    useEffect(() => {
        const exchange = async () => {
            if (!code) return; // If no code, nothing to exchange (maybe came here directly)
            setStatus("exchanging");
            setError(null);

            try {
                const verifier = localStorage.getItem("verifier");
                if (!verifier) {
                    throw new Error("Missing PKCE code_verifier in localStorage.");
                }

                // Build the Okta token endpoint URL
                const tokenUrl = new URL(
                    `${process.env.NEXT_PUBLIC_OKTA_ISSUER}/v1/token`
                );

                const res = await fetch(tokenUrl.toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        grant_type: "authorization_code",
                        client_id: process.env.NEXT_PUBLIC_OKTA_CLIENT_ID!,
                        redirect_uri: process.env.NEXT_PUBLIC_OKTA_REDIRECT_URI!,
                        code,
                        code_verifier: verifier,
                    }),
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(
                        `Token exchange failed (${res.status}): ${truncate(txt, 400)}`
                    );
                }

                const data = await res.json();
                if (!data.id_token) {
                    throw new Error("No id_token in token response.");
                }

                localStorage.setItem("id_token", data.id_token);
                setIdToken(data.id_token);

                // Call your backend (Go Fiber) with the ID token
                setStatus("calling-api");
                const apiUrl =
                    process.env.NEXT_PUBLIC_API_URL ??
                    "http://localhost:8081/api/protected";

                const apiRes = await fetch(apiUrl, {
                    headers: { Authorization: `Bearer ${data.id_token}` },
                    credentials: "include",
                });

                // You may want to handle non-OK responses
                if (!apiRes.ok) {
                    const txt = await apiRes.text();
                    throw new Error(
                        `Backend call failed (${apiRes.status}): ${truncate(txt, 400)}`
                    );
                }

                // If you need the response:
                // const payload = await apiRes.json();
                // console.log("Protected API result:", payload);

                setStatus("done");
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                setStatus("error");
                // Optional: clear sensitive values
                // localStorage.removeItem("id_token");
            }
        };

        exchange();
    }, [code]);

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Callback</h1>

            <div className="text-sm text-gray-600">
                Status:{" "}
                <span className="font-mono">
                    {status === "idle" && "idle"}
                    {status === "exchanging" && "exchanging token…"}
                    {status === "calling-api" && "calling backend…"}
                    {status === "done" && "done"}
                    {status === "error" && "error"}
                </span>
            </div>

            {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
                    <div className="font-medium">Login failed</div>
                    <div className="text-xs break-all mt-1">{error}</div>
                </div>
            )}

            <div className="space-y-2">
                <div className="text-lg font-medium">ID Token</div>
                <div className="text-xs text-gray-500">
                    {/* (Hidden in UI to avoid leaking sensitive data) */}
                </div>
                <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                    {idToken ? idToken : TOKEN_PLACEHOLDER}

                </div>
            </div>
            <div className="space-y-2">
                <div className="text-lg font-medium">Access Token</div>
                <div className="text-xs text-gray-500">
                    {/* (Hidden in UI to avoid leaking sensitive data) */}
                </div>
                <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                    {ac ? ac : TOKEN_PLACEHOLDER}

                </div>
            </div>
            <div className="space-y-2">
                <div className="text-lg font-medium">Refresh Token</div>
                <div className="text-xs text-gray-500">
                    {/* (Hidden in UI to avoid leaking sensitive data) */}
                </div>
                <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                    {re ? re : TOKEN_PLACEHOLDER}

                </div>
            </div>

            {status !== "done" && <LoadingUI label="Logging in..." />}
        </div>
    );
}

function LoadingUI({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            <div>{label}</div>
        </div>
    );
}

function maskToken(tk: string) {
    // show small prefix & suffix for debugging, hide middle
    if (tk.length <= 16) return "•••";
    return `${tk.slice(0, 10)}…${tk.slice(-10)}`;
}

function truncate(s: string, max: number) {
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}