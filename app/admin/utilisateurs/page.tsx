"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { formatBIF } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Users,
  ShoppingBasket,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Ban,
  Star,
  Filter,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { apiFetch, getApiErrorStatus, getRoleLabel, normalizeRole, type CanonicalRole } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | CanonicalRole;
type StatusFilter = "all" | "active" | "suspended";
type UserStatus = Exclude<StatusFilter, "all">;
type EditableRole = Exclude<CanonicalRole, "admin">;

interface User {
  id: number;
  name: string;
  phone_number: string;
  role: string;
  province?: string | null;
  balance: number;
  is_active: boolean;
  gmv: number;
  orders: number;
  status: UserStatus;
  normalizedRole: CanonicalRole | null;
}

interface UserForm {
  name: string;
  phone_number: string;
  province: string;
  role: EditableRole;
}

const EDITABLE_ROLES: EditableRole[] = ["fermier", "acheteur", "logistique"];

const EMPTY_USER_FORM: UserForm = {
  name: "",
  phone_number: "",
  province: "Bujumbura",
  role: "fermier",
};

const roleStyles: Record<CanonicalRole, { icon: ReactNode; color: string }> = {
  fermier: { icon: <Star className="w-3 h-3" />, color: "bg-primary/10 text-primary border-primary/20" },
  acheteur: { icon: <ShoppingBasket className="w-3 h-3" />, color: "bg-accent/30 text-accent-foreground border-accent/30" },
  logistique: { icon: <Truck className="w-3 h-3" />, color: "bg-muted text-muted-foreground border-border" },
  admin: { icon: <ShieldCheck className="w-3 h-3" />, color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const statusStyles: Record<UserStatus, { color: string; icon: ReactNode }> = {
  active: { color: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  suspended: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: <Ban className="w-3 h-3" /> },
};

const usersCopy = {
  fr: {
    title: "Gestion des utilisateurs",
    subtitle: "CRUD des fermiers, acheteurs et livreurs enregistrés sur la plateforme",
    loadError: "Impossible de charger les utilisateurs.",
    requiredFields: "Le nom et le numéro de téléphone sont obligatoires.",
    updatedSuccess: "Utilisateur mis à jour avec succès.",
    createdSuccess: "Utilisateur créé avec succès.",
    saveError: "Impossible d'enregistrer cet utilisateur.",
    suspendedSuccess: "Utilisateur suspendu.",
    reactivatedSuccess: "Utilisateur réactivé.",
    statusError: "Impossible de modifier le statut de cet utilisateur.",
    deletedSuccess: "Utilisateur supprimé avec succès.",
    deleteError: "Impossible de supprimer cet utilisateur.",
    all: "Tous",
    active: "Actif",
    suspended: "Suspendu",
    protectedNoticeStart: "Les comptes",
    protectedNoticeEmphasis: "admin",
    protectedNoticeMiddle: "restent protégés sur cet écran.",
    protectedNoticeEnd: "Leur création dédiée continue de se faire depuis",
    protectedSettings: "Paramètres Admin",
    searchPlaceholder: "Rechercher par nom, téléphone, province...",
    addUser: "Ajouter un utilisateur",
    userColumn: "Utilisateur",
    roleColumn: "Rôle",
    provinceColumn: "Province",
    statusColumn: "Statut",
    activityColumn: "Activité",
    actionsColumn: "Actions",
    loadingUsers: "Chargement des utilisateurs…",
    noUsers: "Aucun utilisateur trouvé.",
    unknownRole: "Rôle inconnu",
    noProvince: "—",
    logisticsActivityHint: "Courses déjà prises en charge",
    orderWord: "commande",
    saleWord: "vente",
    deliveryWord: "livraison",
    adminActivity: "Supervision plateforme",
    protectedLabel: "Protégé",
    reactivate: "Réactiver",
    suspend: "Suspendre",
    editUser: "Modifier {name}",
    deleteUser: "Supprimer {name}",
    displayedSummary: "{count} utilisateur(s) affiché(s)",
    footerSummary: "{suspended} suspendu(s) • {admins} admin(s)",
    createDialogTitle: "Ajouter un utilisateur",
    editDialogTitle: "Modifier un utilisateur",
    createDialogDescription: "Créez ici un nouveau fermier, acheteur ou livreur.",
    editDialogDescription: "Mettez à jour les informations principales de cet utilisateur.",
    fullName: "Nom complet",
    namePlaceholder: "Nom de l'utilisateur",
    phone: "Téléphone",
    province: "Province",
    provincePlaceholder: "Ngozi",
    role: "Rôle",
    adminRoleHelp: "Les comptes administrateurs restent créés via l'écran Paramètres Admin.",
    cancel: "Annuler",
    createUser: "Créer l'utilisateur",
    save: "Enregistrer",
    deleteDialogTitle: "Supprimer cet utilisateur ?",
    deleteTargetDescription: "Le compte de {name} sera retiré définitivement s'il ne possède aucune donnée métier liée.",
    deleteDescription: "Cette action retire définitivement l'utilisateur sélectionné.",
    confirmDelete: "Confirmer la suppression",
  },
  ki: {
    title: "Gucungera abakoresha",
    subtitle: "CRUD y'abarimyi, abaguzi n'abashikiriza biyandikishije ku rubuga",
    loadError: "Ntivyashobotse kuzana abakoresha.",
    requiredFields: "Izina n'inomero ya telefone birakenewe.",
    updatedSuccess: "Uwukoresha yahinduwe neza.",
    createdSuccess: "Uwukoresha yaremwe neza.",
    saveError: "Ntivyashobotse kubika uwukoresha.",
    suspendedSuccess: "Uwukoresha arahagaritswe.",
    reactivatedSuccess: "Uwukoresha yongeye gukoresha konti.",
    statusError: "Ntivyashobotse guhindura uko konti imeze.",
    deletedSuccess: "Uwukoresha yasibwe neza.",
    deleteError: "Ntivyashobotse gusiba uwukoresha.",
    all: "Bose",
    active: "Akora",
    suspended: "Arahagaritswe",
    protectedNoticeStart: "Konti za",
    protectedNoticeEmphasis: "admin",
    protectedNoticeMiddle: "zirakingiwe kuri uru rupapuro.",
    protectedNoticeEnd: "Kuzirema bikorwa biciye kuri",
    protectedSettings: "Paramètres Admin",
    searchPlaceholder: "Rondera kw'izina, telefone canke intara...",
    addUser: "Kwongerako uwukoresha",
    userColumn: "Uwukoresha",
    roleColumn: "Uruhara",
    provinceColumn: "Intara",
    statusColumn: "Uko ameze",
    activityColumn: "Ibikorwa",
    actionsColumn: "Ibikorwa",
    loadingUsers: "Turiko turapakurura abakoresha…",
    noUsers: "Nta mukoresha yabonetse.",
    unknownRole: "Uruhara ntirumenyekana",
    noProvince: "—",
    logisticsActivityHint: "Ingendo zimaze gufatwa",
    orderWord: "komande",
    saleWord: "igurisha",
    deliveryWord: "ugutanga",
    adminActivity: "Gukurikirana urubuga",
    protectedLabel: "Irakingiwe",
    reactivate: "Subizaho",
    suspend: "Hagarika",
    editUser: "Hindura {name}",
    deleteUser: "Siba {name}",
    displayedSummary: "Abakoresha berekanwe: {count}",
    footerSummary: "Abahagaritswe: {suspended} • Admin: {admins}",
    createDialogTitle: "Kwongerako uwukoresha",
    editDialogTitle: "Guhindura uwukoresha",
    createDialogDescription: "Rema hano umurimyi, umuguzi canke umushikiriza mushasha.",
    editDialogDescription: "Hindura amakuru nyamukuru y'uwukoresha.",
    fullName: "Izina ryose",
    namePlaceholder: "Izina ry'uwukoresha",
    phone: "Telefone",
    province: "Intara",
    provincePlaceholder: "Ngozi",
    role: "Uruhara",
    adminRoleHelp: "Konti z'ubuyobozi ziremerwa kuri Paramètres Admin.",
    cancel: "Kureka",
    createUser: "Rema uwukoresha",
    save: "Bika",
    deleteDialogTitle: "Gusiba uwukoresha?",
    deleteTargetDescription: "Konti ya {name} izosibwa burundu nimba ata makuru y'akazi ayifatanije.",
    deleteDescription: "Iki gikorwa gisiba burundu uwukoresha yatoranijwe.",
    confirmDelete: "Emeza gusiba",
  },
} as const;

function mapAdminUser(u: any): User {
  return {
    ...u,
    province: u.province ?? null,
    balance: Number(u.balance ?? 0),
    gmv: Number(u.gmv ?? 0),
    orders: Number(u.orders ?? 0),
    normalizedRole: normalizeRole(u.role),
    status: u.is_active ? "active" : "suspended",
  };
}

function buildUserPayload(form: UserForm) {
  return {
    name: form.name.trim(),
    phone_number: form.phone_number.trim(),
    province: form.province.trim() || null,
    role: form.role,
  };
}

function getUserInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminUtilisateursPage() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusUserId, setStatusUserId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER_FORM);
  const [savingUser, setSavingUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const copy = usersCopy[lang];
  const roleConfig: Record<CanonicalRole, { label: string; icon: ReactNode; color: string }> = {
    fermier: { ...roleStyles.fermier, label: getRoleLabel("fermier", lang) },
    acheteur: { ...roleStyles.acheteur, label: getRoleLabel("acheteur", lang) },
    logistique: { ...roleStyles.logistique, label: getRoleLabel("logistique", lang) },
    admin: { ...roleStyles.admin, label: getRoleLabel("admin", lang) },
  };
  const statusConfig: Record<UserStatus, { label: string; color: string; icon: ReactNode }> = {
    active: { ...statusStyles.active, label: copy.active },
    suspended: { ...statusStyles.suspended, label: copy.suspended },
  };

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await apiFetch("/users");
      setUsers(Array.isArray(data) ? data.map(mapAdminUser) : []);
      setError(null);
    } catch (err: unknown) {
      logIfNotNetworkError("Users fetch error", err);
      setError(getDisplayErrorMessage(err, copy.loadError));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadUsers();
  }, [loadUsers, ready, session]);

  const handleEditorOpenChange = useCallback((open: boolean) => {
    setEditorOpen(open);
    if (!open) {
      setEditingUser(null);
      setEditorMode("create");
      setUserForm(EMPTY_USER_FORM);
    }
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditorMode("create");
    setEditingUser(null);
    setUserForm(EMPTY_USER_FORM);
    setEditorOpen(true);
    setError(null);
    setFeedback(null);
  }, []);

  const openEditDialog = useCallback((user: User) => {
    if (user.normalizedRole === "admin") return;

    setEditorMode("edit");
    setEditingUser(user);
    setUserForm({
      name: user.name,
      phone_number: user.phone_number,
      province: user.province ?? "",
      role: (user.normalizedRole ?? "acheteur") as EditableRole,
    });
    setEditorOpen(true);
    setError(null);
    setFeedback(null);
  }, []);

  const handleSubmitUser = useCallback(async () => {
    const payload = buildUserPayload(userForm);
    if (!payload.name || !payload.phone_number) {
      setError(copy.requiredFields);
      return;
    }

    setSavingUser(true);
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(editorMode === "edit" && editingUser ? `/users/${editingUser.id}` : "/users/", {
        method: editorMode === "edit" ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadUsers(true);
      handleEditorOpenChange(false);
      setFeedback(editorMode === "edit" ? copy.updatedSuccess : copy.createdSuccess);
    } catch (err: unknown) {
      logIfNotNetworkError("User save error", err);
      setError(getDisplayErrorMessage(err, copy.saveError));
    } finally {
      setSavingUser(false);
    }
  }, [copy.createdSuccess, copy.requiredFields, copy.saveError, copy.updatedSuccess, editingUser, editorMode, handleEditorOpenChange, loadUsers, userForm]);

  const handleToggleStatus = useCallback(async (user: User) => {
    if (user.normalizedRole === "admin") return;

    setStatusUserId(user.id);
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      await loadUsers(true);
      setFeedback(user.is_active ? copy.suspendedSuccess : copy.reactivatedSuccess);
    } catch (err: unknown) {
      logIfNotNetworkError("User status update error", err);
      setError(getDisplayErrorMessage(err, copy.statusError));
    } finally {
      setStatusUserId(null);
    }
  }, [copy.reactivatedSuccess, copy.statusError, copy.suspendedSuccess, loadUsers]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteTarget) return;

    setDeletingUserId(deleteTarget.id);
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      await loadUsers(true);
      setDeleteTarget(null);
      setFeedback(copy.deletedSuccess);
    } catch (err: unknown) {
      if (getApiErrorStatus(err) !== 400) {
        logIfNotNetworkError("User delete error", err);
      }
      setError(getDisplayErrorMessage(err, copy.deleteError));
    } finally {
      setDeletingUserId(null);
    }
  }, [copy.deleteError, copy.deletedSuccess, deleteTarget, loadUsers]);

  const formatMetricCount = useCallback((count: number, noun: string) => {
    if (lang === "ki") {
      return `${noun} ${count}`;
    }
    return `${count} ${noun}${count > 1 ? "s" : ""}`;
  }, [lang]);

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.normalizedRole === roleFilter;
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.phone_number.includes(q) || (u.province || "").toLowerCase().includes(q);
    return matchRole && matchStatus && matchSearch;
  });

  const counts = {
    fermier: users.filter(u => u.normalizedRole === "fermier").length,
    acheteur: users.filter(u => u.normalizedRole === "acheteur").length,
    logistique: users.filter(u => u.normalizedRole === "logistique").length,
    active: users.filter(u => u.status === "active").length,
    suspended: users.filter(u => u.status === "suspended").length,
    admin: users.filter(u => u.normalizedRole === "admin").length,
  };

  return (
    <AdminLayout
      title={copy.title}
      subtitle={copy.subtitle}
    >
      {/* Role summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "fermier", "acheteur", "logistique"] as RoleFilter[]).map((role) => {
          const isAll = role === "all";
          const cfg = !isAll ? roleConfig[role] : null;
          const count = isAll ? users.length : (counts as any)[role];
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={cn(
                "text-left p-3 rounded-xl border transition-all",
                roleFilter === role
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {isAll
                  ? <Users className="w-4 h-4 text-muted-foreground" />
                  : <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs border", cfg!.color)}>{cfg!.icon}</span>
                }
                <span className="text-xs font-medium text-muted-foreground">{isAll ? copy.all : getRoleLabel(role, lang)}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? "..." : count}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        {copy.protectedNoticeStart} <span className="font-medium text-foreground">{copy.protectedNoticeEmphasis}</span> {copy.protectedNoticeMiddle}
        {" "}{copy.protectedNoticeEnd} <span className="font-medium text-foreground">{copy.protectedSettings}</span>.
      </div>

      {/* Search & status filter */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            {(["all", "active", "suspended"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {s === "all" ? copy.all : statusConfig[s].label}
                {s === "suspended" && counts.suspended > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold inline-flex items-center justify-center">
                    {counts.suspended}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Button onClick={openCreateDialog} className="gap-2 xl:min-w-[190px]">
            <UserPlus className="w-4 h-4" />
            {copy.addUser}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      )}

      {/* Users table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{copy.userColumn}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{copy.roleColumn}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{copy.provinceColumn}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{copy.statusColumn}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">{copy.activityColumn}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">{copy.actionsColumn}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {copy.loadingUsers}
                    </span>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {copy.noUsers}
                  </td>
                </tr>
              )}

              {!loading && filtered.map((u) => {
                const role = u.normalizedRole ? roleConfig[u.normalizedRole] : null;
                const st = statusConfig[u.status];
                const isUpdating = statusUserId === u.id;
                const isDeleting = deletingUserId === u.id;
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {getUserInitials(u.name)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground leading-tight">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.phone_number}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge className={cn("text-xs border flex items-center gap-1 w-fit h-auto py-0.5", role?.color || "bg-muted text-muted-foreground border-border")}>
                        {role?.icon || <Users className="w-3 h-3" />}{role?.label || copy.unknownRole}
                      </Badge>
                    </td>
                    {/* Province */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">{u.province || copy.noProvince}</td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge className={cn("text-xs border flex items-center gap-1 w-fit h-auto py-0.5", st.color)}>
                        {st.icon}{st.label}
                      </Badge>
                    </td>
                    {/* Activity */}
                    <td className="px-4 py-3 text-right">
                      {u.normalizedRole === "logistique" ? (
                        <div>
                          <p className="text-xs font-semibold text-foreground">{formatMetricCount(u.orders, copy.deliveryWord)}</p>
                          <p className="text-[10px] text-muted-foreground">{copy.logisticsActivityHint}</p>
                        </div>
                      ) : u.normalizedRole === "acheteur" ? (
                        <div>
                          <p className="text-xs font-semibold text-foreground">{formatBIF(u.gmv)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatMetricCount(u.orders, copy.orderWord)}</p>
                        </div>
                      ) : u.normalizedRole === "fermier" ? (
                        <div>
                          <p className="text-xs font-semibold text-foreground">{formatBIF(u.gmv)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatMetricCount(u.orders, copy.saleWord)}</p>
                        </div>
                      ) : u.normalizedRole === "admin" ? (
                        <p className="text-xs text-muted-foreground">{copy.adminActivity}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{copy.noProvince}</p>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {u.normalizedRole === "admin" ? (
                          <span className="text-[11px] text-muted-foreground">{copy.protectedLabel}</span>
                        ) : (
                          <>
                            {u.status === "suspended" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdating || isDeleting}
                                onClick={() => void handleToggleStatus(u)}
                                className="h-7 text-xs border-border px-2.5"
                              >
                                <span className="flex items-center gap-1">
                                  {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                                  {copy.reactivate}
                                </span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdating || isDeleting}
                                onClick={() => void handleToggleStatus(u)}
                                className="h-7 text-xs border-border text-destructive hover:bg-destructive/10 px-2.5"
                              >
                                <span className="flex items-center gap-1">
                                  {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                                  {copy.suspend}
                                </span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={copy.editUser.replace("{name}", u.name)}
                              disabled={isUpdating || isDeleting}
                              onClick={() => openEditDialog(u)}
                              className="h-7 px-2 border-border"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={copy.deleteUser.replace("{name}", u.name)}
                              disabled={isUpdating || isDeleting}
                              onClick={() => setDeleteTarget(u)}
                              className="h-7 px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{copy.displayedSummary.replace("{count}", String(filtered.length))}</p>
          <p className="text-xs text-muted-foreground">{copy.footerSummary.replace("{suspended}", String(counts.suspended)).replace("{admins}", String(counts.admin))}</p>
        </div>
      </Card>

      <Dialog open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? copy.createDialogTitle : copy.editDialogTitle}</DialogTitle>
            <DialogDescription>
              {editorMode === "create"
                ? copy.createDialogDescription
                : copy.editDialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="user-form-name" className="text-sm font-medium text-foreground">{copy.fullName}</label>
              <Input
                id="user-form-name"
                value={userForm.name}
                onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={copy.namePlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="user-form-phone" className="text-sm font-medium text-foreground">{copy.phone}</label>
              <Input
                id="user-form-phone"
                value={userForm.phone_number}
                onChange={(event) => setUserForm((current) => ({ ...current, phone_number: event.target.value }))}
                placeholder="+257..."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="user-form-province" className="text-sm font-medium text-foreground">{copy.province}</label>
              <Input
                id="user-form-province"
                value={userForm.province}
                onChange={(event) => setUserForm((current) => ({ ...current, province: event.target.value }))}
                placeholder={copy.provincePlaceholder}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="user-form-role" className="text-sm font-medium text-foreground">{copy.role}</label>
              <select
                id="user-form-role"
                value={userForm.role}
                onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as EditableRole }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {EDITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {getRoleLabel(role, lang)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {copy.adminRoleHelp}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleEditorOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button onClick={() => void handleSubmitUser()} disabled={savingUser} className="gap-2">
              {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : editorMode === "create" ? <UserPlus className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {editorMode === "create" ? copy.createUser : copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deletingUserId && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? copy.deleteTargetDescription.replace("{name}", deleteTarget.name)
                : copy.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingUserId)}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={Boolean(deletingUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUserId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {copy.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
