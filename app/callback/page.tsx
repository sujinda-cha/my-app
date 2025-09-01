"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, GoRes } from "@/utils/api";

type Status = "idle" | "exchanging" | "calling-api" | "done" | "error";

type DataO = {
    accessToken: string;
    refreshToken: string;
};

const TOKEN_PLACEHOLDER = "•••"; // ไม่โชว์ token เต็มใน UI

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
    const [ac, setAc] = useState<string>(""); // access token
    const [re, setRe] = useState<string | null>(null); // refresh token

    const [oldAc, setOldAc] = useState<string>("");
    const [oldRe, setOldRe] = useState<string | null>(null);

    // รับ token จาก query (ถ้ามี)
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

    // อ่าน authorization code ครั้งเดียว
    const code = useMemo(() => searchParams.get("code"), [searchParams]);

    useEffect(() => {
        const exchange = async () => {
            if (!code) return; // ไม่มี code แสดงว่าไม่ได้มาจาก authorize
            setStatus("exchanging");
            setError(null);

            try {
                const verifier = localStorage.getItem("verifier");
                if (!verifier) {
                    throw new Error("Missing PKCE code_verifier in localStorage.");
                }

                // Okta token endpoint
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

                // เก็บ/โชว์ token
                localStorage.setItem("id_token", data.id_token);
                setIdToken(data.id_token);

                if (data.access_token) setAc(data.access_token);
                if (data.refresh_token) setRe(data.refresh_token);

                // (ออปชัน) call backend ที่ต้องการ id_token
                setStatus("calling-api");
                const apiUrl =
                    process.env.NEXT_PUBLIC_API_URL ??
                    "http://localhost:8081/api/protected";

                const apiRes = await fetch(apiUrl, {
                    headers: { Authorization: `Bearer ${data.id_token}` },
                    credentials: "include",
                });

                if (!apiRes.ok) {
                    const txt = await apiRes.text();
                    throw new Error(
                        `Backend call failed (${apiRes.status}): ${truncate(txt, 400)}`
                    );
                }

                setStatus("done");
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                setStatus("error");
            }
        };

        exchange();
    }, [code]);

    // refresh token (เรียก backend ของคุณ)
    const refreshToken = async () => {
        try {
            const res: GoRes<DataO> = await apiFetch(
                "http://127.0.0.1:12345/api/v1/auth/refresh",
                {
                    method: "POST",
                    body: { refreshToken: re ?? rt ?? "" }, // ใช้ค่าจาก state ถ้าไม่มีลองค่าใน query
                    token: ac || "",
                }
            );
            if (res.code === 0) {
                setOldAc(ac);
                setOldRe(re);
                setAc(res.data?.accessToken);
                setRe(res.data?.refreshToken);
            } else {
                console.error("Refresh failed:", res.message);
            }
        } catch (error: unknown) {
            console.log(error);
        }
    };

    // revoke token (เรียก backend ของคุณ)
    const revokeToken = async () => {
        try {
            const res = await apiFetch("http://127.0.0.1:12345/api/v1/auth/revoke", {
                method: "POST",
                body: {},
                token: ac || "",
            });
            if (res.code === 0) {
                console.log("revoked", res);
            }
        } catch (error) {
            console.log(error);
        }
    };

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

            <div className="flex gap-[20px]">
                <div className="w-[50%] space-y-4">
                    <TokenBox label="ID Token" value={idToken} />
                    <TokenBox label="Access Token" value={ac} />
                    <TokenBox label="Refresh Token" value={re} />
                </div>

                <div className="w-[50%] space-y-4">
                    <TokenBox label="Old Access Token" value={oldAc} />
                    <TokenBox label="Old Refresh Token" value={oldRe} />
                </div>
            </div>

            {status !== "done" && <LoadingUI label="Logging in..." />}

            <div className="flex gap-3">
                <button
                    className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition"
                    onClick={refreshToken}
                    disabled={!re && !rt}
                    title={!re && !rt ? "No refresh token available" : ""}
                >
                    Refresh Token
                </button>
                <button
                    className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition disabled:opacity-50"
                    onClick={revokeToken}
                    disabled={!ac}
                    title={!ac ? "No access token" : ""}
                >
                    Revoke Token
                </button>
            </div>
        </div>
    );
}

function TokenBox({
                      label,
                      value,
                  }: {
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div className="space-y-2">
            <div className="text-lg font-medium">{label}</div>
            <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                {value ? value : TOKEN_PLACEHOLDER}
            </div>
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

function truncate(s: string, max: number) {
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}