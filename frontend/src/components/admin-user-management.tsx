"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { Customer, Profile, StaffDetail } from "@/types";
import {
  createStaffAccount,
  toggleCustomerAccountStatus,
  toggleStaffStatus,
  updateStaffProfile,
} from "@/lib/actions/user-management";
import { saveCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CustomerRow = Customer & {
  subscriptionsCount?: number;
};

export type StaffRow = Profile & {
  staff_details?: StaffDetail[];
};

export function AdminUserManagement({
  customers,
  staff,
  currentAdminId,
}: {
  customers: CustomerRow[];
  staff: StaffRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "staff" ? "staff" : "customers";

  const [activeTab, setActiveTab] = React.useState<"customers" | "staff">(initialTab);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  // Dialog states
  const [addStaffOpen, setAddStaffOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // View / Edit / Toggle dialog targets
  const [viewCustomer, setViewCustomer] = React.useState<CustomerRow | null>(null);
  const [viewStaff, setViewStaff] = React.useState<StaffRow | null>(null);
  const [editStaff, setEditStaff] = React.useState<StaffRow | null>(null);
  const [editCustomer, setEditCustomer] = React.useState<CustomerRow | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    destructive?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  });

  // Filtered customers
  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? c.status === "active" : c.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  // Filtered staff
  const filteredStaff = React.useMemo(() => {
    return staff.filter((s) => {
      const detail = s.staff_details?.[0];
      const matchesSearch =
        (s.full_name && s.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (detail?.department && detail.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (detail?.designation && detail.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? s.status !== "inactive" : s.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [staff, searchQuery, statusFilter]);

  const totalPages = Math.ceil(
    (activeTab === "customers" ? filteredCustomers.length : filteredStaff.length) / pageSize
  );

  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Switch tab resets pagination
  const handleTabChange = (tab: "customers" | "staff") => {
    setActiveTab(tab);
    setCurrentPage(1);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`?${params.toString()}`);
  };

  // Staff creation handler
  async function handleAddStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await createStaffAccount(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create staff account");
        return;
      }
      toast.success(res.message ?? "Staff account created");
      setAddStaffOpen(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Staff edit handler
  async function handleEditStaffSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editStaff) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateStaffProfile(editStaff.id, formData);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update staff");
        return;
      }
      toast.success("Staff profile updated");
      setEditStaff(null);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Customer edit handler
  async function handleEditCustomerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCustomer) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("id", editCustomer.id);
    try {
      const res = await saveCustomer(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update customer");
        return;
      }
      toast.success("Customer profile updated");
      setEditCustomer(null);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Confirm staff toggle
  function promptToggleStaff(staffMember: StaffRow) {
    const isCurrentlyActive = staffMember.status !== "inactive";
    const targetStatus = isCurrentlyActive ? "inactive" : "active";
    setConfirmDialog({
      open: true,
      title: isCurrentlyActive ? "Deactivate Staff Account?" : "Activate Staff Account?",
      description: isCurrentlyActive
        ? `Are you sure you want to deactivate ${staffMember.full_name || staffMember.email}? They will immediately lose access to the staff portal and dashboard until reactivated.`
        : `Activate ${staffMember.full_name || staffMember.email}? They will regain access to manage customers and subscriptions.`,
      destructive: isCurrentlyActive,
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await toggleStaffStatus(staffMember.id, targetStatus);
          if (!res.ok) {
            toast.error(res.error ?? "Could not change status");
            return;
          }
          toast.success(res.message);
          router.refresh();
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  // Confirm customer toggle
  function promptToggleCustomer(cust: CustomerRow) {
    const isCurrentlyActive = cust.status === "active";
    const targetStatus = isCurrentlyActive ? "inactive" : "active";
    setConfirmDialog({
      open: true,
      title: isCurrentlyActive ? "Deactivate Customer Account?" : "Activate Customer Account?",
      description: isCurrentlyActive
        ? `Are you sure you want to deactivate ${cust.name}? Their portal login and active billing will be flagged as inactive.`
        : `Activate ${cust.name}? Their customer record and portal access will be marked active.`,
      destructive: isCurrentlyActive,
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await toggleCustomerAccountStatus(cust.id, targetStatus);
          if (!res.ok) {
            toast.error(res.error ?? "Could not update customer status");
            return;
          }
          toast.success(res.message);
          router.refresh();
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Tabs and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => handleTabChange("customers")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "customers"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            Customers ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("staff")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "staff"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="size-3.5" />
            Staff Members ({staff.length})
          </button>
        </div>

        {activeTab === "staff" ? (
          <Button size="sm" onClick={() => setAddStaffOpen(true)}>
            <UserPlus className="size-4 mr-1.5" /> Add Staff Member
          </Button>
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "customers"
                ? "Search customers by name, email, company, ID..."
                : "Search staff by name, email, department, designation..."
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | "active" | "inactive");
              setCurrentPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
      </div>

      {/* Tables Section */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {activeTab === "customers" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Registration Date</th>
                  <th className="px-4 py-3 font-semibold">Account Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Subscriptions</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No customer records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {cust.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {cust.name}
                        {cust.company ? <span className="block text-[11px] text-muted-foreground font-normal">{cust.company}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{cust.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{cust.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(cust.created_at)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={cust.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {cust.subscriptionsCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem onClick={() => setViewCustomer(cust)}>
                              <Eye className="size-3.5 mr-2" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditCustomer(cust)}>
                              <Pencil className="size-3.5 mr-2" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => promptToggleCustomer(cust)}
                              className={cust.status === "active" ? "text-destructive" : "text-emerald-600"}
                            >
                              <Power className="size-3.5 mr-2" />
                              {cust.status === "active" ? "Deactivate Account" : "Activate Account"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Staff ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Department / Designation</th>
                  <th className="px-4 py-3 font-semibold">Date Joined</th>
                  <th className="px-4 py-3 font-semibold">Account Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No staff accounts found. Click &quot;Add Staff Member&quot; to invite a team member.
                    </td>
                  </tr>
                ) : (
                  paginatedStaff.map((st) => {
                    const detail = st.staff_details?.[0];
                    const isSelf = st.id === currentAdminId;
                    return (
                      <tr key={st.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {st.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {st.full_name || st.email}
                          {isSelf ? <span className="ml-1.5 text-[10px] text-primary font-normal">(You)</span> : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{st.email}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{detail?.designation ?? "Staff"}</span>
                          {detail?.department ? <span className="text-[11px] text-muted-foreground block">{detail.department}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(detail?.joined_at || st.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={st.status || "active"} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem onClick={() => setViewStaff(st)}>
                                <Eye className="size-3.5 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditStaff(st)}>
                                <Pencil className="size-3.5 mr-2" /> Edit Details
                              </DropdownMenuItem>
                              {!isSelf ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => promptToggleStaff(st)}
                                    className={st.status !== "inactive" ? "text-destructive" : "text-emerald-600"}
                                  >
                                    <Power className="size-3.5 mr-2" />
                                    {st.status !== "inactive" ? "Deactivate Account" : "Activate Account"}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <p>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create an operational staff account. An invitation and password setup link will be dispatched securely.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff_full_name">Full name</Label>
              <Input id="staff_full_name" name="full_name" placeholder="Alex Morgan" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff_email">Work email</Label>
              <Input id="staff_email" name="email" type="email" placeholder="alex@brightloop.io" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff_phone">Phone number</Label>
              <Input id="staff_phone" name="phone" placeholder="+1 415 555 0192" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff_department">Department</Label>
                <Input id="staff_department" name="department" placeholder="Customer Success" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff_designation">Designation</Label>
                <Input id="staff_designation" name="designation" placeholder="Account Manager" required />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddStaffOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <UserPlus className="size-3.5 mr-1.5" />}
                Create Staff Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog */}
      <Dialog open={!!viewCustomer} onOpenChange={(open) => !open && setViewCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>Registered customer profile and billing record.</DialogDescription>
          </DialogHeader>
          {viewCustomer ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Name</p>
                  <p className="font-medium text-sm mt-0.5">{viewCustomer.name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Status</p>
                  <div className="mt-1"><StatusBadge value={viewCustomer.status} /></div>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p><span className="text-muted-foreground">Email:</span> {viewCustomer.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {viewCustomer.phone || "—"}</p>
                <p><span className="text-muted-foreground">Company:</span> {viewCustomer.company || "—"}</p>
                <p><span className="text-muted-foreground">Billing Address:</span> {viewCustomer.address || "—"}</p>
                <p><span className="text-muted-foreground">Registered:</span> {formatDate(viewCustomer.created_at)}</p>
                <p><span className="text-muted-foreground">Portal Account:</span> {viewCustomer.user_id ? "Linked" : "Self-service invite pending"}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCustomer(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Staff Dialog */}
      <Dialog open={!!viewStaff} onOpenChange={(open) => !open && setViewStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Member Details</DialogTitle>
            <DialogDescription>Operational staff account and designation details.</DialogDescription>
          </DialogHeader>
          {viewStaff ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Staff Name</p>
                  <p className="font-medium text-sm mt-0.5">{viewStaff.full_name || viewStaff.email}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Status</p>
                  <div className="mt-1"><StatusBadge value={viewStaff.status || "active"} /></div>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p><span className="text-muted-foreground">Email:</span> {viewStaff.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {viewStaff.phone || "—"}</p>
                <p><span className="text-muted-foreground">Department:</span> {viewStaff.staff_details?.[0]?.department || "General Operations"}</p>
                <p><span className="text-muted-foreground">Designation:</span> {viewStaff.staff_details?.[0]?.designation || "Staff"}</p>
                <p><span className="text-muted-foreground">Joined Date:</span> {formatDate(viewStaff.staff_details?.[0]?.joined_at || viewStaff.created_at)}</p>
                <p><span className="text-muted-foreground">Role:</span> Staff (Operational)</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewStaff(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editStaff} onOpenChange={(open) => !open && setEditStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update staff information, department, or operational status.</DialogDescription>
          </DialogHeader>
          {editStaff ? (
            <form onSubmit={handleEditStaffSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit_staff_name">Full name</Label>
                <Input id="edit_staff_name" name="full_name" defaultValue={editStaff.full_name || ""} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_staff_phone">Phone</Label>
                <Input id="edit_staff_phone" name="phone" defaultValue={editStaff.phone || ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_staff_dept">Department</Label>
                  <Input
                    id="edit_staff_dept"
                    name="department"
                    defaultValue={editStaff.staff_details?.[0]?.department || ""}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_staff_desig">Designation</Label>
                  <Input
                    id="edit_staff_desig"
                    name="designation"
                    defaultValue={editStaff.staff_details?.[0]?.designation || ""}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_staff_status">Account Status</Label>
                <select
                  id="edit_staff_status"
                  name="status"
                  defaultValue={editStaff.status || "active"}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditStaff(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Information</DialogTitle>
            <DialogDescription>Modify primary customer contact or billing details.</DialogDescription>
          </DialogHeader>
          {editCustomer ? (
            <form onSubmit={handleEditCustomerSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit_cust_name">Customer name</Label>
                <Input id="edit_cust_name" name="name" defaultValue={editCustomer.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_cust_email">Email address</Label>
                <Input id="edit_cust_email" name="email" type="email" defaultValue={editCustomer.email} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_cust_company">Legal company</Label>
                <Input id="edit_cust_company" name="company" defaultValue={editCustomer.company || ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_cust_phone">Phone</Label>
                <Input id="edit_cust_phone" name="phone" defaultValue={editCustomer.phone || ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_cust_address">Billing address</Label>
                <Input id="edit_cust_address" name="address" defaultValue={editCustomer.address || ""} />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditCustomer(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Save Customer
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.destructive ? (
                <AlertTriangle className="size-5 text-destructive" />
              ) : (
                <UserCheck className="size-5 text-primary" />
              )}
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmDialog.destructive ? "destructive" : "default"}
              onClick={confirmDialog.action}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
              Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
