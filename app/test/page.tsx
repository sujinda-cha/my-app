"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, GoRes } from "@/utils/api";

type Status = "idle" | "exchanging" | "calling-api" | "done" | "error";

type DataO = {
    accessToken: string,
    refreshToken: string,
}
const TOKEN_PLACEHOLDER = "•••"; // don’t leak the whole token in the UI
const DEFAULT_ROUTE = "http://localhost:12345/api/v1/";
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
    const [ac, setAc] = useState<string>("");
    const [re, setRe] = useState<string | null>(null);
    const [url, setUrl] = useState<string>("http://localhost:12345/api/v1/");
    const [result, setResult] = useState<object>();
    const [oldAc, setOldAc] = useState<string>("");
    const [oldRe, setOldRe] = useState<string | null>(null);

    const [selected, setSelected] = useState<string>("POST");
    const [reqBody, setReqBody] = useState<string>("");

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

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setUrl(e.target.value);
        },
        []
    );

    const handleChangeTX = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setReqBody(e.target.value);
        },
        []
    );
    const finalUrl = useMemo(() => {
        const v = url.trim();
        if (!v) return DEFAULT_ROUTE;

        try {
            const u = new URL(v, typeof window !== "undefined" ? window.location.origin : "http://localhost");
            return u.toString();
        } catch {
            return DEFAULT_ROUTE;
        }
    }, [url]);

    const gogo = async () => {
        try {
            const method = (selected || "GET").toUpperCase();

            // parse อย่างปลอดภัย + ปล่อย undefined ถ้าไม่มี body
            let body: any | undefined = undefined;
            if (reqBody && reqBody.trim() !== "") {
                try {
                    body = JSON.parse(reqBody);
                } catch (e) {
                    console.error("Invalid JSON in reqBody:", e);
                    // แสดงแจ้งเตือนผู้ใช้หรือ return ออกเลยก็ได้
                    return;
                }
            }

            const res: GoRes<object> = await apiFetch(finalUrl, {
                method,
                body, // apiFetch จะเปลี่ยนเป็น query string เองเมื่อเป็น GET/HEAD
                // token: accessToken, // ถ้ามี Bearer token ใส่เพิ่มได้
            });

            if (res.code === 0) {
                setResult(res.data);
            } else {
                console.warn("API returned non-zero code:", res.code, res.message);
                // อยากโชว์ข้อความผิดพลาดก็ทำตรงนี้ได้
            }
        } catch (error) {
            console.error(error);
            // setError(String(error)) // ถ้ามี state error
        }
    };
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

    const refreshToken = async () => {
        try {
            const res: GoRes<DataO> = await apiFetch("http://127.0.0.1:12345/api/v1/auth/refresh",
                {
                    method: "POST",
                    body: {
                        "refreshToken": rt,
                    },
                    token: ac || "",
                }
            )
            if (res.code === 0) {
                console.log("log refresh", res)
                setOldAc(ac)
                setOldRe(re)
                setAc(res.data?.accessToken)
                setRe(res.data?.refreshToken)
            } else {
                console.error("Login failed:", res.message);
            }
        } catch (error: unknown) {
            console.log(error)
        }
    }
    const revokeToken = async () => {
        try {
            const res = await apiFetch("http://127.0.0.1:12345/api/v1/auth/revoke",
                {
                    method: "POST",
                    body: {},
                    token: ac || "",
                }
            )
            if (res.code === 0) {
                console.log("log revoke", res)
            }
        } catch (error) {
            console.log(error)
        }
    }
    const rht = async () => {
        try {
            window.location.assign("http://127.0.0.1:8080/api/start-stepup?txnId=txn123&bindingHash=abc123");
        } catch (error) {
            console.log(error)
        }
    }
    // const rht = async () => {
    //     try {
    //         window.open(
    //             "http://127.0.0.1:8080/api/start-stepup?txnId=txn123&bindingHash=abc123",
    //             "_blank" // เปิดใน tab ใหม่
    //         );
    //     } catch (error) {
    //         console.log(error);
    //     }
    // };
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
                <div className="w-[50%]">
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
                </div>
                <div className="w-[50%]">

                    <div className="space-y-2">
                        <div className="text-lg font-medium text-gray-700">Old Access Token</div>
                        <div className="text-xs text-gray-500">
                            {/* (Hidden in UI to avoid leaking sensitive data) */}
                        </div>
                        <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                            {oldAc ? oldAc : TOKEN_PLACEHOLDER}

                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-lg font-medium text-gray-700">Old Refresh Token</div>
                        <div className="text-xs text-gray-500">
                            {/* (Hidden in UI to avoid leaking sensitive data) */}
                        </div>
                        <div className="break-all font-mono rounded-md border p-2 bg-gray-50">
                            {oldRe ? oldRe : TOKEN_PLACEHOLDER}

                        </div>
                    </div>
                </div>
            </div>

            {status !== "done" && <LoadingUI label="Logging in..."/>}

            <div className={`flex gap-[8px]`}>
                <button
                    className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition"
                    onClick={refreshToken}
                >
                    Refresh Token
                </button>
                <button
                    className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition"
                    onClick={revokeToken}
                >
                    Revoke Okta
                </button>
                <button
                    className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition"
                    onClick={rht}
                >
                    Request Higher Token
                </button>
            </div>


            <div className="flex gap-[20px]">
                <div className="w-[50%]">
                    <label htmlFor="api-url" className="w-24">
                        API URL:
                    </label>
                    <input
                        id="api-url"
                        type="text"
                        value={url}
                        onChange={handleChange}
                        placeholder={DEFAULT_ROUTE}
                        className="border mb-2 border-amber-600 rounded-lg h-8 w-full px-2 outline-none"
                    />
                    <label htmlFor="api-url" className="w-24">
                        Body (json):
                    </label>
                    <textarea
                        id="api-url"
                        value={reqBody}
                        onChange={handleChangeTX}
                        placeholder={"json only"}
                        className="border mb-2 border-amber-600 rounded-lg h-[200px] w-full px-2 outline-none"
                    />
                    <label className="" htmlFor="">Method :</label>
                    <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="radio"
                                name="fileType"
                                value="GET"
                                checked={selected === 'GET'}
                                onChange={(e) => setSelected(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-green-700">GET</span>
                        </label>

                        <label className="inline-flex items-center gap-2">
                            <input
                                type="radio"
                                name="fileType"
                                value="POST"
                                checked={selected === 'POST'}
                                onChange={(e) => setSelected(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-yellow-600">POST</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="radio"
                                name="fileType"
                                value="PUT"
                                checked={selected === 'PUT'}
                                onChange={(e) => setSelected(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-blue-500">PUT</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="radio"
                                name="fileType"
                                value="POST"
                                checked={selected === 'PATCH'}
                                onChange={(e) => setSelected(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-purple-500">PATCH</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="radio"
                                name="fileType"
                                value="DELETE"
                                checked={selected === 'DELETE'}
                                onChange={(e) => setSelected(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-red-500">DELETE</span>
                        </label>
                    </div>
                    <button
                        className="mt-6 px-4 py-2 bg-red-500 hover:bg-amber-600 rounded-2xl text-white transition"
                        onClick={gogo}
                    >
                        Fire !!!
                    </button>
                </div>
                <div className="w-[50%]">
                    <label htmlFor="">
                        Result Here
                    </label>
                    <textarea className="border mb-2 border-amber-600 rounded-lg h-[600px] w-full px-2 outline-none"
                              name="" id="" readOnly value={JSON.stringify(result, null, 2)}></textarea>
                </div>
            </div>

        </div>
    );
}

function LoadingUI({label}: { label: string }) {
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