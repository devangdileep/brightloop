import { redirect } from "next/navigation";
import { requireProfile, getRoleHome } from "@/lib/auth";

export default async function DashboardRedirectPage() {
  const { profile } = await requireProfile();
  redirect(getRoleHome(profile.role));
}
