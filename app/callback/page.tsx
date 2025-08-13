'use client'
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function Callback() {
    const searchParams = useSearchParams()
    const [tk, setTk] = useState<string>()

    useEffect(() => {
        const search = searchParams.get('token')
        if (search) {
            setTk(search)
        }
    })
    useEffect(() => {
        const handle = async () => {
            const params = new URLSearchParams(window.location.search)
            const code = params.get("code")
            const verifier = localStorage.getItem("verifier")

            const res = await fetch(`${process.env.NEXT_PUBLIC_OKTA_ISSUER}/v1/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: process.env.NEXT_PUBLIC_OKTA_CLIENT_ID!,
                    redirect_uri: process.env.NEXT_PUBLIC_OKTA_REDIRECT_URI!,
                    code: code!,
                    code_verifier: verifier!
                })
            })

            const data = await res.json()
            localStorage.setItem("id_token", data.id_token)

            // เรียก API Go Fiber
            const api = await fetch("http://localhost:8081/api/protected", {
                headers: {
                    Authorization: `Bearer ${data.id_token}`
                }
            })
            const json = await api.json()
            alert(JSON.stringify(json, null, 2))
        }
        handle()
    }, [])

    return (
        <div className="">
            <div className="flex">
                <div className="text-5xl">Token</div>
            </div>
                <div className="break-all">
                    <p>{tk}</p>
                </div>

            <div className="mt-6">Logging in...</div>
        </div>
    )
}