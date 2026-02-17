"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Mail,
  Palette,
  DollarSign,
  Eye,
  Shield,
  Loader2,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface UserSettings {
  notifyTradeFilled: boolean;
  notifyOrderUpdates: boolean;
  notifyCardVerified: boolean;
  notifyEscrowReleased: boolean;
  notifyShipmentUpdate: boolean;
  notifyDisputeUpdate: boolean;
  notifyPriceAlerts: boolean;
  notifyNewListings: boolean;
  notifyLendingUpdates: boolean;
  notifyAnnouncements: boolean;
  emailDigest: boolean;
  theme: string;
  currency: string;
  profilePublic: boolean;
  showTradeHistory: boolean;
}

const notificationSettings = [
  { key: "notifyTradeFilled", label: "Trade filled", description: "When your order gets matched and a trade executes" },
  { key: "notifyOrderUpdates", label: "Order updates", description: "Partial fills, cancellations, and order status changes" },
  { key: "notifyCardVerified", label: "Card verification", description: "When your cards are verified or verification fails" },
  { key: "notifyEscrowReleased", label: "Escrow released", description: "When payment escrow is released to the seller" },
  { key: "notifyShipmentUpdate", label: "Shipment updates", description: "Tracking updates for inbound and outbound shipments" },
  { key: "notifyDisputeUpdate", label: "Dispute updates", description: "When disputes are opened, reviewed, or resolved" },
  { key: "notifyPriceAlerts", label: "Price alerts", description: "Price movement alerts on cards you're watching" },
  { key: "notifyNewListings", label: "New listings", description: "New cards listed from your favorited sets" },
  { key: "notifyLendingUpdates", label: "Lending updates", description: "Loan offers, funding, and repayment notifications" },
  { key: "notifyAnnouncements", label: "Platform announcements", description: "Important updates and new features from Cardboard" },
] as const;

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "JPY", label: "JPY (\u00A5)" },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        checked ? "bg-primary" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function SettingsTab() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchSettings = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const { data } = await res.json();
        setSettings(data);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function updateSettings(updates: Partial<UserSettings>) {
    const token = getAccessToken();
    if (!token || !settings) return;

    // Optimistic update
    setSettings({ ...settings, ...updates });
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const { data } = await res.json();
        setSettings(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Revert on error
      fetchSettings();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
        <p className="text-muted-foreground">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Save indicator */}
      {(saving || saved) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2 text-sm shadow-lg">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                Saved
              </>
            )}
          </div>
        </div>
      )}

      {/* Notification preferences */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Notifications
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 divide-y divide-border/30">
          {notificationSettings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium">{setting.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
              <Toggle
                checked={settings[setting.key as keyof UserSettings] as boolean}
                onChange={(val) => updateSettings({ [setting.key]: val })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Email preferences */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Email Preferences
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">Email digest</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive a daily summary of your activity and notifications
              </p>
            </div>
            <Toggle
              checked={settings.emailDigest}
              onChange={(val) => updateSettings({ emailDigest: val })}
            />
          </div>
        </div>
      </section>

      {/* Display preferences */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Display
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 divide-y divide-border/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred appearance</p>
            </div>
            <div className="flex gap-2">
              {["dark", "light"].map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSettings({ theme })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    settings.theme === theme
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Currency</p>
                <p className="text-xs text-muted-foreground mt-0.5">Default currency for prices</p>
              </div>
            </div>
            <select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Privacy
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 divide-y divide-border/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">Public profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Allow other users to view your profile and reputation
              </p>
            </div>
            <Toggle
              checked={settings.profilePublic}
              onChange={(val) => updateSettings({ profilePublic: val })}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">Show trade history</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display your trade history on your public profile
              </p>
            </div>
            <Toggle
              checked={settings.showTradeHistory}
              onChange={(val) => updateSettings({ showTradeHistory: val })}
            />
          </div>
        </div>
      </section>

      {/* Security & Account */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Security & Account
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 divide-y divide-border/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">API keys</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate API keys for programmatic access
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-400">Delete account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </Button>
            </div>
            {showDeleteConfirm && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">This action is irreversible</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Account deletion is not yet available. Please contact support at
                      support@cardboard.com to request account deletion.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="mt-2"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
