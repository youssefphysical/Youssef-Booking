import AuthPage from "@/pages/AuthPage";

export default function AdminAccessPage() {
  return <AuthPage initialMode="admin-login" adminOnly />;
}
