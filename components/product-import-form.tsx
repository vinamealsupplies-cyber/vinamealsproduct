"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { commitProductImportAction } from "@/app/admin/imports/actions";
import type { SimpleImportRow } from "@/lib/import/product-import";

type Preview = {
  worksheet: string;
  unknownHeaders: string[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  operationCounts: { create: number; update: number; upsert: number };
  rows: Array<{ rowNumber: number; values: Record<string, unknown>; errors: string[]; warnings: string[] }>;
  commitRows: SimpleImportRow[];
};

export function ProductImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setCommitMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/imports/products/preview", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "The workbook could not be analyzed.");
      setPreview(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The workbook could not be analyzed.");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!preview?.commitRows?.length) return;
    setCommitting(true);
    setCommitMessage("");
    setError("");
    try {
      const result = await commitProductImportAction(preview.commitRows);
      if (result.status === "error") {
        setError(result.message);
      } else {
        setCommitMessage(result.message);
        setPreview(null);
        setFile(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="import-workspace">
      <section className="form-card import-upload-card">
        <div className="import-icon">
          <FileSpreadsheet size={30} />
        </div>
        <div>
          <h2>Upload product workbook</h2>
          <p>
            Only <strong>3 columns</strong> are required:{" "}
            <code>product_name</code>, <code>retail_price</code>, <code>inventory</code>. Each row gets a new product
            ID, handle, and SKU automatically. Leave category empty — items show under <strong>Shop all</strong> until
            you assign a category. Add photos later in Products.
          </p>
          <div className="import-actions">
            <label className="button secondary">
              <Upload size={17} /> Choose .xlsx file
              <input
                className="visually-hidden"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setError("");
                  setCommitMessage("");
                }}
              />
            </label>
            <button className="button primary" type="button" onClick={analyze} disabled={!file || loading}>
              {loading ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Preview
            </button>
            <Link className="text-link" href="/templates/product-import-template.xlsx">
              Download template
            </Link>
          </div>
          {file ? (
            <p className="selected-workbook">
              <strong>Selected:</strong> {file.name} ({Math.ceil(file.size / 1024)} KB)
            </p>
          ) : null}
          {error ? (
            <div className="inline-error">
              <AlertCircle size={18} /> {error}
            </div>
          ) : null}
          {commitMessage ? (
            <div className="form-success" role="status">
              {commitMessage}
            </div>
          ) : null}
        </div>
      </section>

      {preview ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Validation preview</h2>
              <p>Worksheet: {preview.worksheet}</p>
            </div>
          </div>
          <div className="import-summary-grid">
            <div>
              <span>Total rows</span>
              <strong>{preview.totalRows}</strong>
            </div>
            <div>
              <span>Valid</span>
              <strong>{preview.validRows}</strong>
            </div>
            <div>
              <span>Warnings</span>
              <strong>{preview.warningRows}</strong>
            </div>
            <div>
              <span>Errors</span>
              <strong>{preview.errorRows}</strong>
            </div>
          </div>
          {preview.unknownHeaders.length ? (
            <div className="inline-warning">
              <AlertCircle size={18} /> Extra columns ignored: {preview.unknownHeaders.join(", ")}
            </div>
          ) : null}
          <div className="table-scroll">
            <table className="data-table import-preview-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Product name</th>
                  <th>Retail</th>
                  <th>Inventory</th>
                  <th>Auto SKU</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{String(row.values.product_name ?? "")}</td>
                    <td>{String(row.values.retail_price ?? "")}</td>
                    <td>{String(row.values.inventory ?? "")}</td>
                    <td>{String(row.values.sku ?? "")}</td>
                    <td>
                      {row.errors.length ? (
                        <div className="row-messages error">
                          <strong>Error</strong>
                          {row.errors.map((message) => (
                            <span key={message}>{message}</span>
                          ))}
                        </div>
                      ) : row.warnings.length ? (
                        <div className="row-messages warning">
                          <strong>OK</strong>
                          {row.warnings.map((message) => (
                            <span key={message}>{message}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="status-pill status-valid">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button
              className="button primary"
              type="button"
              disabled={!preview.validRows || committing}
              onClick={commit}
            >
              {committing ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Importing…
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} /> Import {preview.validRows} product
                  {preview.validRows === 1 ? "" : "s"}
                </>
              )}
            </button>
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Valid rows create new products (auto ID/SKU). No category is set — find them under Shop all, then edit to
            add category, sale price, and media.
          </p>
        </section>
      ) : null}
    </div>
  );
}
