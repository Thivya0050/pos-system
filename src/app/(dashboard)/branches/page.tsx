"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  DollarSign,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from "lucide-react";
import { Modal, ModalCancelButton, ModalField, ModalForm } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import { formatRM, getTodayStart } from "@/lib/utils";
import type { Branch } from "@/types/database";

type BranchStats = {
  todayRevenue: number;
  todayOrders: number;
  staffCount: number;
};

type ModalMode = "create" | "edit";
type DeleteMode = "delete" | "deactivate";

const emptyForm = { name: "", address: "", phone: "" };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, BranchStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("delete");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeBranchCount = useMemo(
    () => branches.filter((b) => b.is_active).length,
    [branches]
  );

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);

    const todayStart = getTodayStart().toISOString();
    const [branchesRes, ordersRes, staffRes] = await Promise.all([
      supabase.from("branches").select("*").order("name"),
      supabase
        .from("orders")
        .select("branch_id, total")
        .eq("status", "completed")
        .gte("created_at", todayStart),
      supabase.from("staff").select("branch_id"),
    ]);

    if (branchesRes.error) {
      setError(branchesRes.error.message);
      setBranches([]);
      setBranchStats({});
      setLoading(false);
      return;
    }

    const nextBranches = (branchesRes.data ?? []) as Branch[];
    setBranches(nextBranches);

    const statsMap: Record<string, BranchStats> = {};
    nextBranches.forEach((branch) => {
      statsMap[branch.id] = { todayRevenue: 0, todayOrders: 0, staffCount: 0 };
    });

    (ordersRes.data ?? []).forEach((order) => {
      const branchId = (order as { branch_id: string | null }).branch_id;
      if (!branchId || !statsMap[branchId]) return;
      statsMap[branchId].todayOrders += 1;
      statsMap[branchId].todayRevenue += Number(
        (order as { total: number }).total
      );
    });

    (staffRes.data ?? []).forEach((row) => {
      const branchId = (row as { branch_id: string }).branch_id;
      if (!branchId || !statsMap[branchId]) return;
      statsMap[branchId].staffCount += 1;
    });

    setBranchStats(statsMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  function openCreateModal() {
    setModalMode("create");
    setEditingBranch(null);
    setModalError(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(branch: Branch) {
    setModalMode("edit");
    setEditingBranch(branch);
    setModalError(null);
    setForm({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingBranch(null);
    setModalError(null);
  }

  async function getBranchAssociationCounts(branchId: string) {
    const [ordersRes, staffRes, membersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("branch_id", branchId),
      supabase
        .from("staff")
        .select("*", { count: "exact", head: true })
        .eq("branch_id", branchId),
      supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("branch_id", branchId),
    ]);

    return {
      orders: ordersRes.count ?? 0,
      staff: staffRes.count ?? 0,
      members: membersRes.count ?? 0,
    };
  }

  function isLastActiveBranch(branch: Branch) {
    return branch.is_active && activeBranchCount <= 1;
  }

  async function openDeleteConfirm(branch: Branch) {
    setDeleteError(null);

    if (isLastActiveBranch(branch)) {
      setDeleteMode("deactivate");
      setDeleteMessage(
        "This is the only active branch. At least one active branch is required for Cashier and Dashboard to function."
      );
      setDeleteConfirm(branch);
      return;
    }

    const counts = await getBranchAssociationCounts(branch.id);
    const totalLinked = counts.orders + counts.staff + counts.members;

    if (totalLinked > 0) {
      const parts: string[] = [];
      if (counts.orders > 0) parts.push(`${counts.orders} order${counts.orders === 1 ? "" : "s"}`);
      if (counts.staff > 0) parts.push(`${counts.staff} staff`);
      if (counts.members > 0) parts.push(`${counts.members} member${counts.members === 1 ? "" : "s"}`);

      setDeleteMode("deactivate");
      setDeleteMessage(
        `This branch has ${parts.join(", ")} on record — deactivate instead of delete to preserve history.`
      );
    } else {
      setDeleteMode("delete");
      setDeleteMessage(
        `Are you sure you want to delete ${branch.name}? This action cannot be undone.`
      );
    }

    setDeleteConfirm(branch);
  }

  async function handleDeleteOrDeactivate() {
    if (!deleteConfirm) return;

    if (isLastActiveBranch(deleteConfirm) && deleteMode === "deactivate") {
      setDeleteError(
        "Cannot deactivate the only active branch. Add or activate another branch first."
      );
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    if (deleteMode === "deactivate") {
      const { error: err } = await supabase
        .from("branches")
        .update({ is_active: false } as never)
        .eq("id", deleteConfirm.id);

      if (err) setDeleteError(err.message);
      else {
        setDeleteConfirm(null);
        await fetchBranches();
      }
    } else {
      const { error: err } = await supabase
        .from("branches")
        .delete()
        .eq("id", deleteConfirm.id);

      if (err) {
        setDeleteError(err.message);
        setDeleteMode("deactivate");
        setDeleteMessage(
          "Delete was blocked by linked records. You can deactivate this branch instead."
        );
      } else {
        setDeleteConfirm(null);
        await fetchBranches();
      }
    }

    setDeleting(false);
  }

  async function toggleActive(branch: Branch) {
    if (branch.is_active && isLastActiveBranch(branch)) {
      setError("Cannot deactivate the only active branch.");
      return;
    }

    const { error: err } = await supabase
      .from("branches")
      .update({ is_active: !branch.is_active } as never)
      .eq("id", branch.id);

    if (err) setError(err.message);
    else await fetchBranches();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
    };

    if (modalMode === "edit" && editingBranch) {
      const { error: err } = await supabase
        .from("branches")
        .update(payload as never)
        .eq("id", editingBranch.id);

      if (err) setModalError(err.message);
      else {
        closeModal();
        await fetchBranches();
      }
    } else {
      const { error: err } = await supabase.from("branches").insert([
        { ...payload, is_active: true },
      ] as never);

      if (err) setModalError(err.message);
      else {
        closeModal();
        await fetchBranches();
      }
    }

    setSaving(false);
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0f172a]">Branches</h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Manage pharmacy locations and view today&apos;s branch activity
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
        </div>
      ) : branches.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-[#64748b]">
          <Inbox className="mb-3 h-10 w-10 text-[#cbd5e1]" />
          <p className="text-base font-medium text-[#0f172a]">No branches yet</p>
          <p className="mt-1 text-sm">Add your first branch to get started.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Branch
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => {
            const stats = branchStats[branch.id] ?? {
              todayRevenue: 0,
              todayOrders: 0,
              staffCount: 0,
            };

            return (
              <div key={branch.id} className="card group p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#0f172a]">{branch.name}</p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          branch.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {branch.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleActive(branch)}
                      className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                      title={branch.is_active ? "Deactivate branch" : "Activate branch"}
                    >
                      {branch.is_active ? (
                        <ToggleRight className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(branch)}
                      className="rounded p-1.5 text-[#64748b] opacity-0 transition-opacity hover:bg-[#f1f5f9] hover:text-[#2563eb] group-hover:opacity-100"
                      title="Edit branch"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void openDeleteConfirm(branch)}
                      className="rounded p-1.5 text-[#64748b] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="Delete branch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {(branch.address || branch.phone) && (
                  <div className="mb-4 space-y-1.5 text-sm text-[#64748b]">
                    {branch.address && (
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{branch.address}</span>
                      </p>
                    )}
                    {branch.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{branch.phone}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 border-t border-[#e2e8f0] pt-4">
                  <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
                    <div className="mb-1 flex items-center gap-1 text-[#64748b]">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        Today
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#0f172a]">
                      {formatRM(stats.todayRevenue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
                    <div className="mb-1 flex items-center gap-1 text-[#64748b]">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        Orders
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#0f172a]">
                      {stats.todayOrders}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
                    <div className="mb-1 flex items-center gap-1 text-[#64748b]">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        Staff
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#0f172a]">
                      {stats.staffCount}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalForm
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === "edit" ? "Edit Branch" : "Add Branch"}
        onSubmit={handleSubmit}
        footer={
          <>
            <ModalCancelButton onClick={closeModal} />
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : modalMode === "edit" ? (
                "Save changes"
              ) : (
                "Add Branch"
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
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </ModalField>
        <ModalField label="Address">
          <input
            className="input-field"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </ModalField>
        <ModalField label="Phone">
          <input
            className="input-field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </ModalField>
      </ModalForm>

      <Modal
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError(null);
        }}
        title={deleteMode === "deactivate" ? "Deactivate branch?" : "Delete branch?"}
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
              disabled={deleting || (deleteMode === "deactivate" && !!deleteConfirm && isLastActiveBranch(deleteConfirm))}
              onClick={() => void handleDeleteOrDeactivate()}
              className={deleteMode === "deactivate" ? "btn-primary" : "btn-danger"}
            >
              {deleting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : deleteMode === "deactivate" ? (
                "Deactivate"
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
        <p className="text-sm text-[#64748b]">{deleteMessage}</p>
      </Modal>
    </div>
  );
}
