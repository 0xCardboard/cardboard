import { User, Star, TrendingUp } from "lucide-react";

export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Viewing profile: <span className="font-[family-name:var(--font-mono)] text-xs">{userId}</span>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { icon: User, title: "Reputation", description: "Reputation score and trade history coming soon." },
          { icon: Star, title: "Reviews", description: "Buyer and seller reviews will appear here." },
          { icon: TrendingUp, title: "Activity", description: "Recent trading activity and badges coming soon." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-border/50 bg-card/50 p-8 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <item.icon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-base font-semibold font-[family-name:var(--font-display)]">{item.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
