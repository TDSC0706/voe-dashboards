"use client";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  flexRender, ColumnDef, SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
}

export function DataTable<T>({ data, columns, searchPlaceholder, globalFilter: externalFilter, onGlobalFilterChange: externalSetFilter }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState("");

  const globalFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setGlobalFilter = externalSetFilter ?? setInternalFilter;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div>
      {searchPlaceholder && externalFilter === undefined && (
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          className="mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={cn("px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                      h.column.getCanSort() && "cursor-pointer select-none"
                    )}
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && (
                        h.column.getIsSorted() === "asc" ? <ChevronUp size={14} /> :
                        h.column.getIsSorted() === "desc" ? <ChevronDown size={14} /> :
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{table.getFilteredRowModel().rows.length} registros</span>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border rounded disabled:opacity-30">Anterior</button>
            <span className="px-3 py-1">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="px-3 py-1 border rounded disabled:opacity-30">Próximo</button>
          </div>
        </div>
      )}
    </div>
  );
}
