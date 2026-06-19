"use client";

import { useEffect, useState } from "react";
import { Check, UserRound, Download, Trash2, ShieldCheck } from "lucide-react";
import {
  getProfile,
  saveProfile,
  exportAllData,
  clearAllData,
} from "@/lib/db";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      if (p) setProfile(p);
      setLoading(false);
    });
  }, []);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    await saveProfile(profile);
    pendo?.track("profile_saved", {
      hasAge: profile.age != null,
      hasSex: !!profile.sex,
      hasAllergies: !!profile.allergies,
      hasConditions: !!profile.conditions,
      pregnancyStatus: profile.pregnancy ?? "none",
      filledFieldCount: [
        profile.age != null,
        !!profile.sex,
        !!profile.allergies,
        !!profile.conditions,
        !!profile.pregnancy && profile.pregnancy !== "none",
      ].filter(Boolean).length,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Download everything the app has stored as one JSON file — the user's own backup.
  const exportData = async () => {
    const data = await exportAllData();
    pendo?.track("data_exported", {
      visitCount: data.visits.length,
      reminderCount: data.reminders.length,
      checkinCount: data.checkins.length,
      hasProfile: !!data.profile,
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mediguard-data-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Two-tap delete so it can't fire by accident; clears every store, then resets the form.
  const deleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await clearAllData();
    pendo?.track("all_data_deleted");
    setProfile({});
    setConfirmDelete(false);
    setDeleted(true);
    setTimeout(() => setDeleted(false), 3000);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-accent">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-semibold text-text">
            Your profile
          </h1>
        </div>
      </div>
      <p className="mt-3 text-muted">
        Optional, and it never leaves your device. Adding it lets the safety audit
        flag risks specific to you — like an allergy or pregnancy conflict.
      </p>

      <div className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase text-muted">Age</span>
            <input
              type="number"
              min={0}
              max={120}
              value={profile.age ?? ""}
              onChange={(e) =>
                set("age", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 68"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase text-muted">Sex</span>
            <select
              value={profile.sex ?? ""}
              onChange={(e) =>
                set("sex", (e.target.value || undefined) as Profile["sex"])
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase text-muted">Allergies</span>
          <input
            value={profile.allergies ?? ""}
            onChange={(e) => set("allergies", e.target.value || undefined)}
            placeholder="e.g. penicillin, sulfa drugs"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase text-muted">
            Ongoing conditions
          </span>
          <input
            value={profile.conditions ?? ""}
            onChange={(e) => set("conditions", e.target.value || undefined)}
            placeholder="e.g. type 2 diabetes, high blood pressure"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase text-muted">
            Pregnancy / breastfeeding
          </span>
          <select
            value={profile.pregnancy ?? "none"}
            onChange={(e) =>
              set("pregnancy", e.target.value as Profile["pregnancy"])
            }
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="none">Not applicable</option>
            <option value="pregnant">Pregnant</option>
            <option value="breastfeeding">Breastfeeding</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-medium text-onp transition hover:opacity-90"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save profile"}
        </button>
        {saved && (
          <span className="text-sm text-success">
            Your next audit will use this.
          </span>
        )}
      </div>

      {/* Privacy + data control — your data lives only on this device, and you own it. */}
      <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="font-heading text-xl font-semibold text-text">
            Your data &amp; privacy
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Everything you record — visits, medicines, reminders, your profile and
          check-ins — is stored only on this device, in your browser. It never goes
          to a server of ours. When you run a safety check, the visit text and
          medicine names are sent to Google&rsquo;s Gemini API to analyze, and the
          result comes straight back to your device — nothing is kept on our side.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 rounded-full border border-border bg-bg px-6 py-3 font-medium text-text transition hover:border-accent"
          >
            <Download className="h-4 w-4" /> Export my data
          </button>
          <button
            onClick={deleteAll}
            className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition ${
              confirmDelete
                ? "bg-danger text-white hover:opacity-90"
                : "border border-border bg-bg text-danger hover:border-danger"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete ? "Tap again to confirm" : "Delete all my data"}
          </button>
        </div>
        {confirmDelete && (
          <button
            onClick={() => setConfirmDelete(false)}
            className="mt-3 text-sm font-medium text-muted transition hover:text-text"
          >
            Cancel
          </button>
        )}
        {deleted && (
          <p className="mt-3 text-sm text-success">
            All your data has been deleted from this device.
          </p>
        )}
      </div>
    </main>
  );
}
