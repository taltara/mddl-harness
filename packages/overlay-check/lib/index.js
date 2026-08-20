import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

//#region src/patchFile.ts
/**
* Blueprint owns one marker-delimited region of the profile's
* `cordis.patch.yml` and nothing else. Everything outside the markers — hand
* written rows, comments, `!!js` expressions — survives byte for byte, because
* a config file a GUI cannot share is a config file people stop hand editing.
*/
const BLOCK_START = "# >>> dsh-blueprint managed block";
const BLOCK_END = "# <<< dsh-blueprint managed block";
const BLOCK_HEADER = [
	BLOCK_START,
	"# Written by the Blueprint tab. Edit it there, or delete the whole block",
	"# (markers included) to take these rows back by hand."
].join("\n");
/**
* A marker only counts on its own line at column 0, so the same text inside a
* YAML block scalar or a comment body is not mistaken for one.
*/
function markerIndex(lines, marker, from = 0) {
	for (let i = from; i < lines.length; i += 1) if (lines[i]?.trimEnd() === marker) return i;
	return -1;
}
function splitManagedBlock(source) {
	const lines = source.split("\n");
	const start = markerIndex(lines, BLOCK_START);
	if (start === -1) return {
		before: source,
		managed: void 0,
		after: ""
	};
	const end = markerIndex(lines, BLOCK_END, start + 1);
	if (end === -1) throw new Error(`${BLOCK_START} has no matching ${BLOCK_END}. Fix or remove the block by hand before applying.`);
	let headerStart = start;
	while (headerStart > 0 && lines[headerStart - 1]?.startsWith("# ")) headerStart -= 1;
	return {
		before: lines.slice(0, start).join("\n"),
		managed: lines.slice(start + 1, end).join("\n"),
		after: lines.slice(end + 1).join("\n")
	};
}
/** Whether a file already carries a Blueprint block. */
function hasManagedBlock(source) {
	return markerIndex(source.split("\n"), BLOCK_START) !== -1;
}
function trimTrailingBlankLines(value) {
	return value.replace(/\n+$/, "");
}
/**
* Rebuild a patch file with `rows` as the managed block, leaving every other
* byte where it was. Passing empty rows removes the block entirely.
*/
function composePatchFile(source, rows) {
	const { before, after } = splitManagedBlock(source);
	const head = trimTrailingBlankLines(before);
	const tail = trimTrailingBlankLines(after);
	const body = rows.trim();
	const parts = [];
	if (head !== "") parts.push(head);
	if (body !== "") parts.push([
		BLOCK_HEADER,
		body,
		BLOCK_END
	].join("\n"));
	if (tail !== "") parts.push(tail);
	if (parts.length === 0) return "";
	return `${parts.join("\n\n")}\n`;
}
/**
* Precondition token for a write. Short, and only ever compared to itself —
* this detects a file that moved under us, it is not a security boundary.
*/
function revisionOf(source) {
	return createHash("sha256").update(source, "utf8").digest("hex").slice(0, 16);
}
/** Line-level diff, kept honest: unchanged lines stay in the output. */
function diffLines(before, after) {
	const a = before === "" ? [] : before.split("\n");
	const b = after === "" ? [] : after.split("\n");
	const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
	for (let i$1 = a.length - 1; i$1 >= 0; i$1 -= 1) for (let j$1 = b.length - 1; j$1 >= 0; j$1 -= 1) {
		const row = lcs[i$1];
		const next = lcs[i$1 + 1];
		if (row === void 0 || next === void 0) continue;
		row[j$1] = a[i$1] === b[j$1] ? (next[j$1 + 1] ?? 0) + 1 : Math.max(next[j$1] ?? 0, row[j$1 + 1] ?? 0);
	}
	const out = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			out.push({
				kind: "same",
				text: a[i] ?? ""
			});
			i += 1;
			j += 1;
			continue;
		}
		if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
			out.push({
				kind: "remove",
				text: a[i] ?? ""
			});
			i += 1;
		} else {
			out.push({
				kind: "add",
				text: b[j] ?? ""
			});
			j += 1;
		}
	}
	for (; i < a.length; i += 1) out.push({
		kind: "remove",
		text: a[i] ?? ""
	});
	for (; j < b.length; j += 1) out.push({
		kind: "add",
		text: b[j] ?? ""
	});
	return out;
}

//#endregion
//#region src/preflight.ts
function isInsertOp(op) {
	return "insert" in op;
}
/** `@scope/pkg/sub` → `@scope/pkg`; `pkg/sub` → `pkg`. */
function packageNameOf(specifier) {
	const parts = specifier.split("/");
	if (specifier.startsWith("@")) return parts.slice(0, 2).join("/");
	return parts[0] ?? specifier;
}
/** Cordis builtins and relative files are not npm packages. */
function isBarePackage(specifier) {
	return specifier !== "" && !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.includes(":");
}
/**
* Whether the profile can actually load this package.
*
* Presence is checked rather than `require.resolve`, because an ESM-only
* package that exports no `require` condition resolves fine for the loader
* and throws here — a false alarm on a package that works.
*/
async function isInstalled(profileDir, specifier) {
	const name = packageNameOf(specifier);
	for (const dir of [profileDir, join(profileDir, "..")]) try {
		await access(join(dir, "node_modules", name, "package.json"));
		return true;
	} catch {}
	return false;
}
/**
* Check an overlay before it is written.
*
* A row naming a package the profile cannot load does not degrade — it is
* fatal. Cordis fails module resolution during boot, so the harness does not
* start at all and the only way back is editing YAML by hand. That makes this
* the one check worth blocking a write over, rather than reporting afterwards
* on a live tree that will never exist.
*/
async function preflightOps(profileDir, ops, liveIds = /* @__PURE__ */ new Set()) {
	const findings = [];
	for (const op of ops) {
		const rows = isInsertOp(op) ? op.insert : [op];
		for (const row of rows) {
			const name = row.name;
			if (typeof name !== "string" || !isBarePackage(name)) continue;
			if (await isInstalled(profileDir, name)) continue;
			findings.push({
				level: "blocking",
				code: "module-not-installed",
				text: `"${name}" is not installed in this profile. Applying this would stop the harness booting at all, not just disable the row. Install it first: dsh plugin --profile <name> add ${name}`
			});
		}
	}
	for (const op of ops) if (isInsertOp(op)) {
		for (const row of op.insert) if (liveIds.has(row.id)) findings.push({
			level: "warning",
			code: "insert-over-existing",
			text: `"${row.id}" already exists in the running tree, so inserting it again is likely to collide rather than add.`
		});
	}
	return findings;
}
/**
* Why the harness would call a preset composition broken, or undefined when it
* looks loadable.
*
* Discovery treats a preset whose composition is missing or is not a list of
* named plugin rows as broken, and it is unmemoized — a bad preset is visible
* in the picker immediately. Checking our own output is enough here, because
* the composition is compiler-generated rather than user text.
*/
function presetProblem(composition) {
	const rows = composition.split("\n").filter((line) => line.startsWith("- id:"));
	if (rows.length === 0) return "the composition has no plugin rows, so the preset would list as broken";
	if (composition.split("\n").filter((line) => line.trimStart().startsWith("name:")).length < rows.length) return "every row needs a name, or the preset lists as broken";
}

//#endregion
//#region src/snapshot.ts
const MANIFEST = "manifest.json";
function hashOf(content) {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
/** Refuse a path that would escape the root. Symlinks are not followed. */
function relativeTo(root, path) {
	const rel = relative(resolve(root), resolve(root, path));
	if (rel.startsWith("..") || rel === "") throw new Error(`snapshot: "${path}" is outside the snapshot root`);
	return rel.split(sep).join("/");
}
async function readIfExists(path) {
	try {
		return await readFile(path);
	} catch (cause) {
		if (cause.code === "ENOENT") return null;
		throw cause;
	}
}
/**
* Capture the current state of `paths` before anything mutates them.
*
* A file that does not exist is captured as absent — restoring later removes
* it rather than leaving whatever the failed install created. That case is
* why "restore" cannot be a plain copy loop: `dsh plugin add` on a fresh
* profile creates files that have no pre-install content at all.
*/
async function takeSnapshot(store, label, paths) {
	const entries = [];
	const captured = [];
	for (const path of paths) {
		const rel = relativeTo(store.root, path);
		const content = await readIfExists(resolve(store.root, rel));
		captured.push({
			rel,
			content
		});
		entries.push({
			path: rel,
			revision: content === null ? null : hashOf(content)
		});
	}
	const createdAt = (/* @__PURE__ */ new Date()).toISOString();
	const manifest = {
		id: hashOf(JSON.stringify(entries) + label + createdAt + Math.random()),
		createdAt,
		label,
		entries
	};
	const snapDir = join(store.dir, manifest.id);
	await mkdir(snapDir, { recursive: true });
	for (const { rel, content } of captured) {
		if (content === null) continue;
		const target = join(snapDir, "files", rel);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
	await writeFile(join(snapDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	return manifest;
}
/** Manifests, newest first. A directory without a readable manifest is skipped. */
async function listSnapshots(store) {
	let ids = [];
	try {
		ids = await readdir(store.dir);
	} catch {
		return [];
	}
	const manifests = [];
	for (const id of ids) try {
		const raw = await readFile(join(store.dir, id, MANIFEST), "utf8");
		manifests.push(JSON.parse(raw));
	} catch {}
	return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/**
* Compare the live files against a snapshot without changing anything.
* Returns the relative paths that differ. Empty means byte-equivalent.
*/
async function diffAgainstSnapshot(store, manifest) {
	const changed = [];
	for (const entry of manifest.entries) {
		const live = await readIfExists(resolve(store.root, entry.path));
		if ((live === null ? null : hashOf(live)) !== entry.revision) changed.push(entry.path);
	}
	return changed;
}
/**
* Bring every captured file back to its snapshot state.
*
* The current (failed) state is snapshotted first, so a rollback is itself
* recoverable and the failure evidence survives for diagnostics — rolling
* back is the moment someone is already having a bad day, and it must not be
* the irreversible step. Writes go through a temp file and rename in the same
* directory, so a reader sees old bytes or new bytes and never half of either.
*/
async function restoreSnapshot(store, manifest) {
	const evidence = await takeSnapshot(store, `pre-restore of ${manifest.id} (${manifest.label})`, manifest.entries.map((entry) => entry.path));
	const restored = [];
	const removed = [];
	for (const entry of manifest.entries) {
		const livePath = resolve(store.root, entry.path);
		if (entry.revision === null) {
			await rm(livePath, { force: true });
			removed.push(entry.path);
			continue;
		}
		const saved = await readFile(join(store.dir, manifest.id, "files", entry.path));
		await mkdir(dirname(livePath), { recursive: true });
		const temp = `${livePath}.snapshot-${process.pid}.tmp`;
		await writeFile(temp, saved, { flag: "wx" });
		await rename(temp, livePath);
		restored.push(entry.path);
	}
	const drift = await diffAgainstSnapshot(store, manifest);
	if (drift.length > 0) throw new Error(`snapshot: restore did not converge for ${drift.join(", ")}`);
	return {
		restored,
		removed,
		evidence
	};
}
/** Drop old snapshots, keeping the newest `keep`. Returns removed ids. */
async function pruneSnapshots(store, keep) {
	const stale = (await listSnapshots(store)).slice(Math.max(0, keep));
	for (const manifest of stale) await rm(join(store.dir, manifest.id), {
		recursive: true,
		force: true
	});
	return stale.map((manifest) => manifest.id);
}
/** Size on disk of one snapshot, for display. */
async function snapshotBytes(store, manifest) {
	let total = 0;
	for (const entry of manifest.entries) {
		if (entry.revision === null) continue;
		try {
			const info = await stat(join(store.dir, manifest.id, "files", entry.path));
			total += info.size;
		} catch {}
	}
	return total;
}
/** Copy of a snapshot's captured content for one path, or null if absent. */
async function snapshotContent(store, manifest, path) {
	const entry = manifest.entries.find((item) => item.path === path);
	if (entry === void 0 || entry.revision === null) return null;
	return readFile(join(store.dir, manifest.id, "files", entry.path));
}
/** Re-export for callers that keep their own copies. */
async function copySnapshotTo(store, manifest, destination) {
	await mkdir(destination, { recursive: true });
	await copyFile(join(store.dir, manifest.id, MANIFEST), join(destination, MANIFEST));
	for (const entry of manifest.entries) {
		if (entry.revision === null) continue;
		const target = join(destination, "files", entry.path);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(join(store.dir, manifest.id, "files", entry.path), target);
	}
}

//#endregion
export { BLOCK_END, BLOCK_START, composePatchFile, copySnapshotTo, diffAgainstSnapshot, diffLines, hasManagedBlock, isBarePackage, isInsertOp, isInstalled, listSnapshots, packageNameOf, preflightOps, presetProblem, pruneSnapshots, restoreSnapshot, revisionOf, snapshotBytes, snapshotContent, splitManagedBlock, takeSnapshot };