"use client";

import React, { useCallback, useMemo, useState } from "react";

const DEFAULT_LOGIN = "http://localhost:12345/api/v1/authentication/login";

export default function Home() {
  const [url, setUrl] = useState<string>("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(e.target.value);
    },
    []
  );

  const finalUrl = useMemo(() => {
    const v = url.trim();
    if (!v) return DEFAULT_LOGIN;

    // Accept absolute or relative URLs; fall back to default if invalid
    try {
      const u = new URL(v, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      return u.toString();
    } catch {
      return DEFAULT_LOGIN;
    }
  }, [url]);

  const login = useCallback(() => {
    // Use assign for a normal navigation (keeps history)
    window.location.assign(finalUrl);
  }, [finalUrl]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") login();
    },
    [login]
  );

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
          placeholder={DEFAULT_LOGIN}
          className="border border-amber-600 rounded-lg h-8 w-full px-2 outline-none"
        />
      </div>

      <button
        className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white transition"
        onClick={login}
      >
        Login with Okta
      </button>

      <p className="mt-2 text-xs text-gray-500">
        Will redirect to: <span className="font-mono break-all">{finalUrl}</span>
      </p>
    </div>
  );
}