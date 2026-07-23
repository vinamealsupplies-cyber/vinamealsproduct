"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpDown, Search } from "lucide-react";
import { formatDate, integer, usd } from "@/lib/format";

type CellValue = string | number | boolean | null;

type Column = {
  key: string;
  label: string;
  kind?: "text" | "currency" | "integer" | "date" | "status" | "boolean";
  align?: "left" | "right";
};

type Row = Record<string, CellValue>;

function displayValue(value: CellValue, kind: Column["kind"]) {
  if (value === null || value === "") return "—";
  if (kind === "currency" && typeof value === "number") return usd.format(value);
  if (kind === "integer" && typeof value === "number") return integer.format(value);
  if (kind === "date" && typeof value === "string") return formatDate(value);
  if (kind === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function SearchableTable({
  columns,
  rows,
  searchPlaceholder = "Search",
  defaultSortKey,
  emptyMessage = "No matching records."
}: {
  columns: Column[];
  rows: Row[];
  searchPlaceholder?: string;
  defaultSortKey?: string;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(defaultSortKey ?? columns[0]?.key ?? "");
  const [ascending, setAscending] = useState(true);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle)))
      : rows;

    return [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "number" && typeof right === "number") return ascending ? left - right : right - left;
      const result = String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
      return ascending ? result : -result;
    });
  }, [ascending, query, rows, sortKey]);

  function changeSort(key: string) {
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  }

  return (
    <div className="data-table-card">
      <div className="table-toolbar">
        <label className="table-search">
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={searchPlaceholder} />
        </label>
        <span>{visibleRows.length} record{visibleRows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.align === "right" ? "numeric" : ""} key={column.key}>
                  <button type="button" onClick={() => changeSort(column.key)}>
                    {column.label}
                    {sortKey === column.key ? <ArrowDownAZ className={ascending ? "" : "sort-desc"} size={15} /> : <ArrowUpDown size={14} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={String(row.id ?? row.sku ?? row.number ?? rowIndex)}>
                {columns.map((column) => {
                  const value = row[column.key];
                  const rendered = displayValue(value, column.kind);
                  return (
                    <td className={column.align === "right" ? "numeric" : ""} key={column.key}>
                      {column.kind === "status" ? <span className={`status-pill status-${String(value).toLowerCase().replaceAll(" ", "-")}`}>{rendered}</span> : rendered}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!visibleRows.length ? <tr><td className="empty-table" colSpan={columns.length}>{emptyMessage}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
