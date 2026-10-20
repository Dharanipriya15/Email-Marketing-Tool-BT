import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | BoilerTech Email Marketing",
};

export default function LoginPage() {
  return <LoginForm />;
}
