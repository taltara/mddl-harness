# Upstream Discussion drafts

Two posts for <https://github.com/deepseek-ai/deepseek-harness/discussions>.
Both are findings from building a third-party plugin against rc.7/rc.8, and
both are things the docs do not currently say. Neither asks for anything.

Post them separately — they have different audiences.

**Do not copy from this file.** Each body lives in its own file so that
"select all, copy" gives you exactly the markdown to paste, with no wrapper
fences or headings from this document leaking in. That leaking is what
mangles the GitHub preview.

## Post 1 — for plugin authors

Title:

Field notes from shipping a third-party plugin: dsh.bundle, the module table, and inject

Body: the entire contents of [discussion-plugin-authoring.md](discussion-plugin-authoring.md).

## Post 2 — for anyone who edits config

Title:

A bad row in cordis.patch.yml doesn't disable a plugin — it stops the harness booting entirely

Body: the entire contents of [discussion-boot-fatality.md](discussion-boot-fatality.md).

## Why the first attempt rendered wrong

The bodies used to live inside this file. Copying a section out of a markdown
document that itself uses code fences produces unbalanced fences, so GitHub
stopped treating the blocks as code — which is why a YAML comment
(`# cordis.patch.yml`) rendered as a giant heading, and why `### 1. Some
heading` collapsed into an ordered list.

Both bodies are now written defensively for that: no numbers in headings, file
names given as prose above each block rather than as comments inside it, every
fence tagged with a language and surrounded by blank lines.
