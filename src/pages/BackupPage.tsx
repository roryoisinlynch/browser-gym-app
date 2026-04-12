import { useRef, useState } from "react";
import { openDatabase, STORE_NAMES, transactionDone, putItem } from "../db/db";
import type { StoreName } from "../db/db";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./BackupPage.css";

const BACKUP_VERSION = 3;
const MIN_COMPATIBLE_VERSION = 2;

type StoreData = Record<string, unknown[]>;

interface BackupFile {
  version: number;
  exportedAt: string;
  stores: StoreData;
}

const ALL_STORES = Object.values(STORE_NAMES) as StoreName[];

async function exportAllStores(): Promise<StoreData> {
  const db = await openDatabase();
  const tx = db.transaction(ALL_STORES, "readonly");
  const result: StoreData = {};
  await Promise.all(
    ALL_STORES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const req = tx.objectStore(name).getAll();
          req.onsuccess = () => {
            result[name] = req.result;
            resolve();
          };
          req.onerror = () => reject(req.error);
        })
    )
  );
  return result;
}

async function restoreAllStores(stores: StoreData): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ALL_STORES, "readwrite");
  for (const name of ALL_STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const record of stores[name] ?? []) {
      store.put(record);
    }
  }
  await transactionDone(tx);
}

function totalRecords(stores: StoreData): number {
  return Object.values(stores).reduce((sum, arr) => sum + arr.length, 0);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function BackupPage() {
  const [exportState, setExportState] = useState<"idle" | "busy" | "done">("idle");
  const [exportedFileName, setExportedFileName] = useState("");

  const [importFile, setImportFile] = useState<BackupFile | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importState, setImportState] = useState<"idle" | "busy" | "done">("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExportState("busy");
    try {
      const stores = await exportAllStores();
      const backup: BackupFile = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        stores,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `gym-backup-${dateStr}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      await putItem(STORE_NAMES.meta, { key: "lastBackupAt", value: backup.exportedAt });
      setExportedFileName(fileName);
      setExportState("done");
    } catch {
      setExportState("idle");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setImportFile(null);
    setImportState("idle");
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupFile;
        if (!parsed.version || !parsed.stores || typeof parsed.stores !== "object") {
          setImportError("This file does not look like a valid gym backup.");
          return;
        }
        setImportFile(parsed);
      } catch {
        setImportError("Could not parse the file. Make sure it is a valid JSON backup.");
      }
    };
    reader.readAsText(file);
  }

  async function handleRestore() {
    if (!importFile) return;
    if (importFile.version < MIN_COMPATIBLE_VERSION) {
      setImportError(
        `This backup was created with an older version of the app (backup version ${importFile.version}, ` +
        `minimum compatible version ${MIN_COMPATIBLE_VERSION}). The data model has changed in a way that is not ` +
        `backward-compatible, so this backup cannot be restored automatically. ` +
        `Please contact support or use the data migration tool.`
      );
      return;
    }
    const confirmed = window.confirm(
      "This will replace all current data with the contents of the backup. This cannot be undone. Continue?"
    );
    if (!confirmed) return;
    setImportState("busy");
    try {
      await restoreAllStores(importFile.stores);
      setImportState("done");
    } catch {
      setImportError("Something went wrong restoring the backup.");
      setImportState("idle");
    }
  }

  return (
    <main className="backup-page">
      <TopBar title="Backup &amp; restore" backTo="/settings" backLabel="Settings" />
      <section className="backup-shell">
        <header className="backup-header">
          <p className="backup-eyebrow">Data</p>
          <h1 className="backup-title">Backup &amp; restore</h1>
          <p className="backup-intro">
            Export a full snapshot of your data to a JSON file you can save anywhere. Use
            the same file to restore your data on another device, or after clearing your
            browser storage.
          </p>
        </header>

        {/* Export */}
        <div className="backup-section">
          <p className="backup-section-label">Export</p>
          <div className="backup-card">
            <p className="backup-card__desc">
              Downloads a single JSON file containing all programs, sessions, exercises,
              set records, and history.
            </p>
            {exportState === "done" ? (
              <p className="backup-card__success">
                Backup downloaded, saved to your default browser downloads location with the name {exportedFileName}.
              </p>
            ) : (
              <button
                type="button"
                className="backup-btn backup-btn--primary"
                disabled={exportState === "busy"}
                onClick={handleExport}
              >
                {exportState === "busy" ? "Exporting…" : "Export backup"}
              </button>
            )}
          </div>
        </div>

        {/* Import */}
        <div className="backup-section">
          <p className="backup-section-label">Restore</p>
          <div className="backup-card">
            <p className="backup-card__desc">
              Select a backup file to restore. All current data will be replaced.
            </p>

            <button
              type="button"
              className="backup-btn backup-btn--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              {importFileName ? importFileName : "Choose backup file…"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {importError && (
              <p className="backup-card__error">{importError}</p>
            )}

            {importFile && importState !== "done" && (
              <div className="backup-preview">
                <p className="backup-preview__row">
                  <span className="backup-preview__key">Exported</span>
                  <span className="backup-preview__val">
                    {formatDate(importFile.exportedAt)}
                  </span>
                </p>
                <p className="backup-preview__row">
                  <span className="backup-preview__key">Records</span>
                  <span className="backup-preview__val">
                    {totalRecords(importFile.stores).toLocaleString()}
                  </span>
                </p>
                <button
                  type="button"
                  className="backup-btn backup-btn--danger"
                  disabled={importState === "busy"}
                  onClick={handleRestore}
                >
                  {importState === "busy" ? "Restoring…" : "Restore backup"}
                </button>
              </div>
            )}

            {importState === "done" && (
              <p className="backup-card__success">
                Restore complete. Reload the app to see your data.
              </p>
            )}
          </div>
        </div>
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
