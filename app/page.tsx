// "use client"
// import Image from "next/image";

// export default function Home() {

//   const openNewPage = async () => {
//     const verifier = generateCodeVerifier(); // เก็บไว้ใน localStorage
//     const challenge = await generateCodeChallenge(verifier);
//     const params = new URLSearchParams({
//       client_id: "0oatwjb0nqpTmA1c7697",      // ✅ client ID ที่ได้จาก Okta
//       redirect_uri: "http://localhost:3000/callback"!,// ✅ URI ที่ลงทะเบียนไว้ใน Okta
//       response_type: 'code',                                   // ✅ ต้องเป็น "code"
//       scope: 'openid profile email',                           // ✅ ต้องมี "openid"
//       grant_type:"authorization_code",
//       code_challenge: challenge,                               // ✅ SHA256 จาก verifier
//       code_challenge_method: 'S256',                           // ✅ ต้องตรงกับที่ Okta รองรับ
      
//       state: 'random_string'                                   // ✅ ควรมี state (optional but recommended)
//     })
//     window.open("https://integrator-5260035.okta.com/oauth2/default/v1/authorize?"+params, "_blank")
//   }
//   return (
//     <div>
//       qwewqewqewqewqewq
//       <button className="bg-amber-300" onClick={() => openNewPage()}>item</button>
//     </div>
//   );
// }

'use client'

export default function Home() {
  const login = async () => {
    // const verifier = generateVerifier()
    // const challenge = await generateChallenge(verifier)
    // localStorage.setItem("verifier", verifier)

    // const params = new URLSearchParams({
    //   client_id: "0oatxqjdophxbSEGs697",
    //   redirect_uri: "http://localhost:3000/callback"!,// ✅ URI ที่ลงทะเบียนไว้ใน Okta
    //   response_type: 'code',                                   // ✅ ต้องเป็น "code"
    //   scope: 'openid profile email',                           // ✅ ต้องมี "openid"
    //   code_challenge: challenge,                               // ✅ SHA256 จาก verifier
    //   code_challenge_method: 'S256',                           // ✅ ต้องตรงกับที่ Okta รองรับ
    //   state: 'random_string'                                   // ✅ ควรมี state (optional but recommended)
    // })
    // window.location.href = `https://integrator-2354893.okta.com/oauth2/default/v1/authorize?${params}`
    window.location.href = "http://localhost:8080/api/start-login";
  }

  return <button onClick={login}>Login with Okta</button>
}

/**
 * สุ่ม code_verifier (ยาว 43-128 ตัวอักษร)
 */
// export function generateVerifier(length: number = 64): string {
//   const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
//   let result = '';
//   const randomValues = crypto.getRandomValues(new Uint8Array(length));
//   for (let i = 0; i < length; i++) {
//     result += charset[randomValues[i] % charset.length];
//   }
//   return result;
// }

// /**
//  * แปลง code_verifier → code_challenge ด้วย SHA256 และ Base64URL
//  */
// export async function generateChallenge(verifier: string): Promise<string> {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(verifier);
//   const digest = await crypto.subtle.digest('SHA-256', data);
//   const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));

//   // แปลงเป็น Base64URL (ตามมาตรฐาน PKCE)
//   return base64
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=+$/, '');
// }