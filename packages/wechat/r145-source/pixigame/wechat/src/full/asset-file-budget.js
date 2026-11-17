// Manage only hash-named files in our own cache directory. Keep files used by
// this run pinned; successful downloads can use their temporary path instead.
export function createAssetFileBudget(files, folder, limit) {
  const entries = new Map();
  let bytes = 0;
  function forget(path) {
    const row = entries.get(path);
    if (row) { entries.delete(path); bytes -= row.size; }
  }
  function record(path, size, used = Date.now(), pinned = true) {
    forget(path); entries.set(path, {size, used, pinned}); bytes += size;
  }
  function trim(extra) {
    for (const [path, row] of [...entries].sort((a, b) => a[1].used - b[1].used)) {
      if (bytes + extra <= limit) break;
      if (row.pinned) continue;
      try { files.unlinkSync(path); forget(path); } catch { /* Unremovable files still count. */ }
    }
  }
  try {
    for (const name of files.readdirSync(folder)) {
      if (!/^[a-f\d]{64}\.[a-z0-9]{1,8}$/i.test(name)) continue;
      const path = folder + '/' + name;
      try {
        const info = files.statSync(path);
        if (Number.isFinite(info.size) && info.size >= 0) record(path, info.size, Number(info.lastModifiedTime) || 0, false);
      } catch { /* An incomplete cache entry is not required. */ }
    }
  } catch { /* Fresh folder or a limited host. */ }
  trim(0);
  return {
    forget,
    touch(path) {
      const row = entries.get(path);
      if (row) { row.pinned = true; row.used = Date.now(); }
      else try { const size = files.statSync(path).size; if (Number.isFinite(size) && size >= 0) record(path, size); } catch {}
    },
    reserve(path, size) {
      if (!Number.isFinite(size) || size <= 0 || size > limit) return false;
      forget(path); trim(size);
      if (bytes + size > limit) return false;
      record(path, size); return true;
    },
    get bytes() { return bytes; },
  };
}
