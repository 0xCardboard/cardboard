"use client";

import { useEffect, useState, use } from "react";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Star,
  CreditCard,
  Settings,
  Shield,
  Loader2,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { getReputationBadge, type ReputationBadge } from "@/types/user";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { PaymentMethodsTab } from "@/components/profile/PaymentMethodsTab";
import { SettingsTab } from "@/components/profile/SettingsTab";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  hasSellerAccount: boolean;
  reputation: {
    score: number;
    totalTrades: number;
    successfulTrades: number;
    avgShipTimeDays: number;
    disputeCount: number;
  } | null;
  _count: {
    cardInstances: number;
    orders: number;
    buyTrades: number;
    sellTrades: number;
    reviewsReceived: number;
  };
}

const tabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "payments", label: "Payment Methods", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];

const badgeColors: Record<ReputationBadge, string> = {
  bronze: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  silver: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  gold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  platinum: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  diamond: "bg-violet-400/10 text-violet-300 border-violet-400/20",
};

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    async function fetchProfile() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const { data } = await res.json();
          setProfile(data);
          setNameInput(data.name || "");
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [userId]);

  async function handleSaveName() {
    const token = getAccessToken();
    if (!token) return;

    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: nameInput.trim() }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setProfile((prev) => (prev ? { ...prev, name: data.name } : prev));
        setEditingName(false);
      }
    } catch {
      // Silently handle errors
    } finally {
      setSavingName(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">Profile not found or not authenticated.</p>
        </div>
      </div>
    );
  }

  const badge = profile.reputation ? getReputationBadge(profile.reputation.score) : "bronze";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start gap-6">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <User className="h-10 w-10 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-2xl font-bold font-[family-name:var(--font-display)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="h-8 w-8 p-0"
                >
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingName(false);
                    setNameInput(profile.name || "");
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
                  {profile.name || "Unnamed User"}
                </h1>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(true)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}

            <Badge className={`${badgeColors[badge]} capitalize`}>{badge}</Badge>

            {profile.role === "ADMIN" && (
              <Badge variant="destructive" className="gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground mt-1">{profile.email}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>

          {/* Quick stats */}
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
                {profile._count.buyTrades + profile._count.sellTrades}
              </p>
              <p className="text-xs text-muted-foreground">Total Trades</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
                {profile._count.cardInstances}
              </p>
              <p className="text-xs text-muted-foreground">Cards Held</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
                {profile.reputation?.score.toFixed(0) ?? "0"}
              </p>
              <p className="text-xs text-muted-foreground">Reputation</p>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
                {profile._count.reviewsReceived}
              </p>
              <p className="text-xs text-muted-foreground ml-1">Reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/40 mb-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            // Only show payments & settings tabs on own profile
            if ((tab.id === "payments" || tab.id === "settings") && !isOwnProfile) return null;

            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <ProfileOverview profile={profile} />}
      {activeTab === "payments" && isOwnProfile && <PaymentMethodsTab />}
      {activeTab === "settings" && isOwnProfile && <SettingsTab />}
    </div>
  );
}
