import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";

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
export { BLOCK_END, BLOCK_START, composePatchFile, diffLines, hasManagedBlock, isBarePackage, isInsertOp, isInstalled, packageNameOf, preflightOps, presetProblem, revisionOf, splitManagedBlock };