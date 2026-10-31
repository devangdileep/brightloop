"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { inviteTeamMember, updateMemberRole } from "@/lib/actions/settings";
import type { UserRole } from "@/types";
import { formatDate, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

export function TeamSettings({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);

  async function changeRole(memberId: string, role: UserRole) {
    setPendingId(memberId);
    try {
      const result = await updateMemberRole(memberId, role);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update role");
        return;
      }
      toast.success(result.message ?? "Role updated");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function invite(formData: FormData) {
    setInviting(true);
    try {
      const result = await inviteTeamMember(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send invitation");
        return;
      }
      toast.success(result.message ?? "Invitation sent");
      router.refresh();
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form action={invite} className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="invite-email" className="text-[11px] font-medium text-muted-foreground">
            Email address
          </label>
          <Input id="invite-email" name="email" type="email" placeholder="teammate@brightloop.io" required />
        </div>
        <div className="w-full space-y-1.5 sm:w-32">
          <label htmlFor="invite-role" className="text-[11px] font-medium text-muted-foreground">
            Role
          </label>
          <Select id="invite-role" name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={inviting} className="sm:h-9">
          {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <MailPlus className="size-3.5" />}
          Send invite
        </Button>
      </form>

      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {initials(member.full_name ?? member.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">
                  {member.full_name ?? member.email}
                  {member.id === currentUserId ? <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(you)</span> : null}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="text-[10px] text-muted-foreground">Joined {formatDate(member.created_at, "MMM yyyy")}</span>
              {member.id === currentUserId ? (
                <StatusBadge value={member.role} />
              ) : (
                <div className="w-28">
                  <Select
                    className="h-7 text-[11px]"
                    value={member.role}
                    disabled={pendingId === member.id}
                    onChange={(event) => changeRole(member.id, event.target.value as UserRole)}
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 ? <p className="py-4 text-center text-[12px] text-muted-foreground">No team members yet.</p> : null}
      </div>

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Role changes are enforced by a database trigger. Invitations use the Supabase Admin API with the service-role
        key, called only from the server.
      </p>
    </div>
  );
}
