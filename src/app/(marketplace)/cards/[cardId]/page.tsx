export default async function CardDetailPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Card Detail</h1>
      <p className="text-muted-foreground">
        Viewing card: {cardId}. Order book and trading UI coming soon.
      </p>
    </div>
  );
}
