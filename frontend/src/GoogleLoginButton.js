import React from "react";
import { useGoogleLogin } from "@react-oauth/google";

export default function GoogleLoginButton({ onLogin }) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onLogin(tokenResponse.access_token),
    onError: () => alert("Google Login Failed"),
  });

  return <button onClick={() => login()}>Login with Google</button>;
}
