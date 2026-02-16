export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <p className="text-muted-foreground">
        Viewing profile: {userId}. Reputation, trade history, and badges coming soon.
      </p>
    </div>
  );
}
