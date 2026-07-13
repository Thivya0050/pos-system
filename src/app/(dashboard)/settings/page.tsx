"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from "lucide-react";
import { getSession, type AuthSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  defaultSettings,
  getSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/settings";
import { setManagerPin, verifyManagerPin } from "@/lib/managerPin";
import {
  Modal,
  ModalCancelButton,
  ModalField,
  ModalForm,
} from "@/components/Modal";
import { PinConfirmModal } from "@/components/PinConfirmModal";
import { useManagerPinGate } from "@/hooks/useManagerPinGate";
import type { Staff } from "@/types/database";

const ADMIN_ROLE = "admin";
const STAFF_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "cashier", label: "Cashier" },
] as const;

type StaffForm = {
  name: string;
  email: string;
  role: string;
  is_active: boolean;
};

const emptyStaffForm: StaffForm = {
  name: "",
  email: "",
  role: "cashier",
  is_active: true,
};

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function isAdminStaff(staff: Pick<Staff, "role" | "is_active">) {
  return normalizeRole(staff.role) === ADMIN_ROLE && staff.is_active;
}

function countActiveAdmins(list: Staff[], excludeId?: string) {
  return list.filter((s) => isAdminStaff(s) && s.id !== excludeId).length;
}

function isCurrentUserStaff(staff: Staff, session: AuthSession | null) {
  if (!session) return false;
  if (session.staffId && staff.id === session.staffId) return true;
  return (
    session.email.trim().toLowerCase() === staff.email.trim().toLowerCase()
  );
}

function wouldRemoveLastActiveAdmin(
  list: Staff[],
  target: Staff,
  updates: { role?: string; is_active?: boolean }
) {
  if (!isAdminStaff(target)) return false;

  const nextRole =
    updates.role !== undefined ? normalizeRole(updates.role) : normalizeRole(target.role);
  const nextActive =
    updates.is_active !== undefined ? updates.is_active : target.is_active;
  const stillActiveAdmin = nextRole === ADMIN_ROLE && nextActive;

  if (stillActiveAdmin) return false;
  return countActiveAdmins(list, target.id) === 0;
}

function getDeleteBlockReason(
  staff: Staff,
  list: Staff[],
  session: AuthSession | null
): string | null {
  if (isCurrentUserStaff(staff, session)) {
    return "You can't delete your own account while logged in.";
  }
  if (isAdminStaff(staff) && countActiveAdmins(list, staff.id) === 0) {
    return "Can't delete the only admin account. Add another admin first.";
  }
  return null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Staff | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { pinOpen, requestPin, closePin, onPinSuccess } = useManagerPinGate();

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setStaffError(null);
    const { data, error: err } = await supabase
      .from("staff")
      .select("*")
      .order("name");
    if (err) setStaffError(err.message);
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

  function openCreateModal() {
    setModalMode("create");
    setEditingStaff(null);
    setStaffForm(emptyStaffForm);
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(member: Staff) {
    setModalMode("edit");
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      email: member.email,
      role: normalizeRole(member.role),
      is_active: member.is_active,
    });
    setModalError(null);
    setModalOpen(true);
  }

  function closeStaffModal() {
    setModalOpen(false);
    setEditingStaff(null);
    setStaffForm(emptyStaffForm);
    setModalError(null);
  }

  function openDeleteConfirm(member: Staff) {
    setDeleteError(null);
    const blockReason = getDeleteBlockReason(member, staff, getSession());
    if (blockReason) {
      setStaffError(blockReason);
      return;
    }
    setDeleteConfirm(member);
  }

  async function resolveBranchId(): Promise<string | null> {
    const session = getSession();
    if (session?.branchId) return session.branchId;

    const { data } = await supabase
      .from("branches")
      .select("id")
      .eq("is_active", true)
      .order("name")
      .limit(1);

    return data?.[0]?.id ?? null;
  }

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setStaffError(null);
    setSavingStaff(true);

    const payload = {
      name: staffForm.name.trim(),
      email: staffForm.email.trim().toLowerCase(),
      role: normalizeRole(staffForm.role),
      is_active: staffForm.is_active,
    };

    if (!payload.name || !payload.email) {
      setModalError("Name and email are required.");
      setSavingStaff(false);
      return;
    }

    if (modalMode === "create") {
      const branchId = await resolveBranchId();
      if (!branchId) {
        setModalError("No active branch found. Add a branch first.");
        setSavingStaff(false);
        return;
      }

      const { error: insertErr } = await supabase.from("staff").insert([
        {
          ...payload,
          branch_id: branchId,
        },
      ] as never);

      if (insertErr) {
        setModalError(insertErr.message);
      } else {
        closeStaffModal();
        await fetchStaff();
      }
    } else if (editingStaff) {
      if (
        wouldRemoveLastActiveAdmin(staff, editingStaff, {
          role: payload.role,
          is_active: payload.is_active,
        })
      ) {
        setModalError(
          "Can't remove the only admin account. Add another admin first."
        );
        setSavingStaff(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from("staff")
        .update(payload as never)
        .eq("id", editingStaff.id);

      if (updateErr) {
        setModalError(updateErr.message);
      } else {
        closeStaffModal();
        await fetchStaff();
      }
    }

    setSavingStaff(false);
  }

  async function handleDeleteStaff() {
    if (!deleteConfirm) return;

    setDeleteError(null);
    setStaffError(null);

    const blockReason = getDeleteBlockReason(deleteConfirm, staff, getSession());
    if (blockReason) {
      setDeleteError(blockReason);
      return;
    }

    setDeleting(true);

    const { error: deleteErr } = await supabase
      .from("staff")
      .delete()
      .eq("id", deleteConfirm.id);

    if (deleteErr) {
      setDeleteError(deleteErr.message);
    } else {
      setDeleteConfirm(null);
      await fetchStaff();
    }

    setDeleting(false);
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
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#64748b]" />
              <h3 className="text-sm font-medium text-[#0f172a]">Staff List</h3>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>

          {staffError && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {staffError}
            </div>
          )}

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
                  <th className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="table-row group">
                    <td className="px-4 font-medium text-[#0f172a]">{s.name}</td>
                    <td className="px-4 text-[#64748b]">{s.email}</td>
                    <td className="px-4 capitalize text-[#64748b]">{s.role}</td>
                    <td className="px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => requestPin(() => openEditModal(s))}
                          className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2563eb]"
                          title="Edit staff"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestPin(() => openDeleteConfirm(s))}
                          className="rounded p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                          title="Delete staff"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PinConfirmModal open={pinOpen} onClose={closePin} onSuccess={onPinSuccess} />

      <ModalForm
        open={modalOpen}
        onClose={closeStaffModal}
        title={modalMode === "create" ? "Add Staff" : "Edit Staff"}
        onSubmit={handleStaffSubmit}
        footer={
          <>
            <ModalCancelButton onClick={closeStaffModal} />
            <button type="submit" disabled={savingStaff} className="btn-primary px-4 py-2 text-sm">
              {savingStaff ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : modalMode === "create" ? (
                "Add Staff"
              ) : (
                "Save changes"
              )}
            </button>
          </>
        }
      >
        {modalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {modalError}
          </div>
        )}

        <ModalField label="Name *">
          <input
            required
            className="input-field"
            value={staffForm.name}
            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
          />
        </ModalField>
        <ModalField label="Email *">
          <input
            required
            type="email"
            className="input-field"
            value={staffForm.email}
            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
          />
        </ModalField>
        <ModalField label="Role">
          <select
            className="input-field"
            value={staffForm.role}
            onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
          >
            {STAFF_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </ModalField>
        <ModalField label="Status">
          <button
            type="button"
            onClick={() =>
              setStaffForm({ ...staffForm, is_active: !staffForm.is_active })
            }
            className="inline-flex items-center gap-2 text-sm text-[#64748b]"
          >
            {staffForm.is_active ? (
              <ToggleRight className="h-6 w-6 text-emerald-500" />
            ) : (
              <ToggleLeft className="h-6 w-6" />
            )}
            <span className={staffForm.is_active ? "text-emerald-700" : "text-[#64748b]"}>
              {staffForm.is_active ? "Active" : "Inactive"}
            </span>
          </button>
        </ModalField>
      </ModalForm>

      <Modal
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError(null);
        }}
        title="Delete staff member?"
        size="narrow"
        footer={
          <>
            <ModalCancelButton
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError(null);
              }}
            />
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteStaff}
              className="btn-danger"
            >
              {deleting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </button>
          </>
        }
      >
        {deleteError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {deleteError}
          </div>
        )}
        <p className="text-sm text-[#64748b]">
          Are you sure you want to delete{" "}
          <span className="font-medium text-[#0f172a]">{deleteConfirm?.name}</span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
