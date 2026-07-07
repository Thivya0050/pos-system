"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, Save, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  defaultSettings,
  getSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/settings";
import { getManagerPin, setManagerPin, verifyManagerPin } from "@/lib/managerPin";
import type { Staff } from "@/types/database";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("staff")
      .select("*")
      .order("name");
    if (err) setError(err.message);
    setStaff(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setSettings(getSettings());
    fetchStaff();
  }, [fetchStaff]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    saveSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setSettings(defaultSettings);
    setSaved(false);
  }

  function handlePinSave(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setPinMessage(null);

    if (!verifyManagerPin(pinForm.current)) {
      setPinError("Current PIN is incorrect");
      return;
    }
    if (!/^\d{4}$/.test(pinForm.next)) {
      setPinError("New PIN must be exactly 4 digits");
      return;
    }
    if (pinForm.next !== pinForm.confirm) {
      setPinError("New PIN and confirmation do not match");
      return;
    }

    setPinSaving(true);
    setManagerPin(pinForm.next);
    setPinForm({ current: "", next: "", confirm: "" });
    setPinSaving(false);
    setPinMessage("Manager PIN updated successfully");
    setTimeout(() => setPinMessage(null), 3000);
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Settings</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">Configure points, tiers, tax, and receipt info</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleReset} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm text-[#64748b] hover:bg-[#f8fafc]">
            Reset Defaults
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved" : "Save Settings"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-[#0f172a]">Points Earning (per RM spent)</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Silver</label>
              <input type="number" min="0" step="0.1" className="input-field" value={settings.pointsPerRmSilver} onChange={(e) => update("pointsPerRmSilver", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Gold</label>
              <input type="number" min="0" step="0.1" className="input-field" value={settings.pointsPerRmGold} onChange={(e) => update("pointsPerRmGold", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Platinum</label>
              <input type="number" min="0" step="0.1" className="input-field" value={settings.pointsPerRmPlatinum} onChange={(e) => update("pointsPerRmPlatinum", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-[#0f172a]">Tier Thresholds (total spend RM)</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Gold minimum spend</label>
              <input type="number" min="0" className="input-field" value={settings.goldMinSpend} onChange={(e) => update("goldMinSpend", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Platinum minimum spend</label>
              <input type="number" min="0" className="input-field" value={settings.platinumMinSpend} onChange={(e) => update("platinumMinSpend", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Tax rate (%)</label>
              <input type="number" min="0" max="100" step="0.1" className="input-field" value={settings.taxRate} onChange={(e) => update("taxRate", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#64748b]" />
            <h3 className="text-sm font-medium text-[#0f172a]">Change Manager PIN</h3>
          </div>
          {pinError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {pinError}
            </div>
          )}
          {pinMessage && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {pinMessage}
            </div>
          )}
          <form onSubmit={handlePinSave} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="input-field"
                value={pinForm.current}
                onChange={(e) => setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Enter current PIN"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="input-field"
                value={pinForm.next}
                onChange={(e) => setPinForm({ ...pinForm, next: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Enter new 4-digit PIN"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="input-field"
                value={pinForm.confirm}
                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Confirm new PIN"
              />
            </div>
            <p className="text-xs text-[#94a3b8]">
              Default PIN: 1234 (change here after saving a new one)
            </p>
            <button type="submit" disabled={pinSaving} className="btn-primary px-4 py-2 text-sm">
              {pinSaving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save PIN"}
            </button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-[#0f172a]">Receipt Information</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Pharmacy Name</label>
              <input className="input-field" value={settings.pharmacyName} onChange={(e) => update("pharmacyName", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#64748b]">Phone</label>
              <input className="input-field" value={settings.pharmacyPhone} onChange={(e) => update("pharmacyPhone", e.target.value)} />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs text-[#64748b]">Address</label>
              <input className="input-field" value={settings.pharmacyAddress} onChange={(e) => update("pharmacyAddress", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <Users className="h-4 w-4 text-[#64748b]" />
            <h3 className="text-sm font-medium text-[#0f172a]">Staff List</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#64748b]" /></div>
          ) : staff.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#64748b]">No staff records found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#64748b]">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="px-4 font-medium text-[#0f172a]">{s.name}</td>
                    <td className="px-4 text-[#64748b]">{s.email}</td>
                    <td className="px-4 capitalize text-[#64748b]">{s.role}</td>
                    <td className="px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
