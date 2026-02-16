export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      {children}
    </div>
  );
}
