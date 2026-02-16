export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <span className="text-sm font-medium text-muted-foreground">Admin Panel</span>
      </div>
      {children}
    </div>
  );
}
