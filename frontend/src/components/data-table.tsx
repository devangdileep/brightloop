"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { FormSchemaKey } from "@/lib/validations";
import type { ActionResult } from "@/types";
import { cn, formatCurrency, formatDate, initials } from "@/lib/utils";
import { runRowAction } from "@/lib/actions/row-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceForm, type FieldDef } from "@/components/resource-form";

export type ColumnKind = "text" | "currency" | "date" | "number" | "badge" | "link" | "entity";

export type TableColumn = {
  key: string;
  header: string;
  kind?: ColumnKind;
  subKey?: string;
  align?: "left" | "right" | "center";
  className?: string;
};

export type RowAction = {
  label: string;
  action: string;
  confirm?: string;
  destructive?: boolean;
};

export type TableRowData = Record<string, unknown> & {
  _href?: string;
  _edit?: Record<string, unknown>;
  _actions?: RowAction[];
};

export function DataTable({
  columns,
  rows,
  searchPlaceholder = "Search…",
  emptyTitle = "Nothing here yet",
  emptyDescription,
  edit,
  pageSize = 10,
  toolbar,
  getRowHref,
}: {
  columns: TableColumn[];
  rows: TableRowData[];
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  edit?: {
    action: (formData: FormData) => Promise<ActionResult>;
    schemaKey: FormSchemaKey;
    fields: FieldDef[];
    title?: string;
  };
  pageSize?: number;
  toolbar?: React.ReactNode;
  getRowHref?: (row: TableRowData) => string | undefined;
}) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [editRow, setEditRow] = React.useState<TableRowData | null>(null);
  const [confirmRow, setConfirmRow] = React.useState<{ row: TableRowData; action: RowAction } | null>(null);
  const [pending, setPending] = React.useState(false);

  const tableColumns = React.useMemo<ColumnDef<TableRowData>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        accessorFn: (row) => row[column.key],
        header: column.header,
        cell: ({ row }) => {
          const value = row.original[column.key];
          const href = row.original._href ?? getRowHref?.(row.original);
          if (column.kind === "currency") {
            return <span className="tabular-nums">{formatCurrency(value as number)}</span>;
          }
          if (column.kind === "number") {
            return <span className="tabular-nums">{String(value ?? "—")}</span>;
          }
          if (column.kind === "date") {
            return <span className="whitespace-nowrap tabular-nums">{formatDate(value as string)}</span>;
          }
          if (column.kind === "badge") {
            return <StatusBadge value={String(value ?? "")} />;
          }
          if (column.kind === "link") {
            return href ? (
              <Link href={href} className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                {String(value ?? "—")}
              </Link>
            ) : (
              <span className="font-medium">{String(value ?? "—")}</span>
            );
          }
          if (column.kind === "entity") {
            const secondary = column.subKey ? row.original[column.subKey] : null;
            return (
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                  {initials(String(value))}
                </span>
                <div className="min-w-0">
                  {href ? (
                    <Link href={href} className="block truncate text-[13px] font-medium hover:text-primary hover:underline">
                      {String(value ?? "—")}
                    </Link>
                  ) : (
                    <p className="truncate text-[13px] font-medium">{String(value ?? "—")}</p>
                  )}
                  {secondary ? <p className="truncate text-[11px] text-muted-foreground">{String(secondary)}</p> : null}
                </div>
              </div>
            );
          }
          return <span className="text-[13px]">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
        },
        meta: { align: column.align, className: column.className },
        enableSorting: true,
      })),
    [columns, getRowHref]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      return Object.entries(row.original).some(([key, value]) => {
        if (key.startsWith("_")) return false;
        return String(value ?? "").toLowerCase().includes(search);
      });
    },
  });

  async function executeAction(row: TableRowData, action: RowAction) {
    setPending(true);
    try {
      const result = await runRowAction(action.action, String(row.id));
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success(result.message ?? "Done");
      setConfirmRow(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {toolbar}
          <span className="text-[11px] text-muted-foreground">
            {total} {total === 1 ? "row" : "rows"}
          </span>
        </div>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as { align?: string; className?: string } | undefined;
                return (
                  <TableHead key={header.id} className={cn(meta?.align === "right" && "text-right", meta?.className)}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                          meta?.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-50" />
                        )}
                      </button>
                    )}
                  </TableHead>
                );
              })}
              {edit || rows.some((row) => row._actions?.length) ? <TableHead className="w-10" /> : null}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length + 1} className="p-0">
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex size-11 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground">
                    <Inbox className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    {emptyDescription ? (
                      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{emptyDescription}</p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const actions = row.original._actions ?? [];
              return (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: string; className?: string } | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(meta?.align === "right" && "text-right", meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                  {edit || actions.length > 0 ? (
                    <TableCell className="w-10 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {edit ? (
                            <DropdownMenuItem onClick={() => setEditRow(row.original)}>
                              <Pencil className="size-3.5" /> Edit
                            </DropdownMenuItem>
                          ) : null}
                          {actions.map((action) => (
                            <DropdownMenuItem
                              key={action.label}
                              className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
                              onClick={() => setConfirmRow({ row: row.original, action })}
                            >
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground">
          {total === 0
            ? "No results"
            : `Showing ${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-3.5" /> Previous
          </Button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {edit ? (
        <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{edit.title ?? "Edit record"}</DialogTitle>
              <DialogDescription>Update the details below and save your changes.</DialogDescription>
            </DialogHeader>
            {editRow ? (
              <ResourceForm
                action={edit.action}
                schemaKey={edit.schemaKey}
                fields={edit.fields}
                defaults={{
                  ...(editRow._edit ?? editRow),
                  id: editRow.id,
                }}
                submitLabel="Save changes"
                onSuccess={() => setEditRow(null)}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={Boolean(confirmRow)} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmRow?.action.label}</DialogTitle>
            <DialogDescription>
              {confirmRow?.action.confirm ?? "Are you sure you want to continue? This action affects live billing data."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRow(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmRow?.action.destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() => confirmRow && executeAction(confirmRow.row, confirmRow.action)}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
