export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {children}
      </div>
    </div>
  );
}
