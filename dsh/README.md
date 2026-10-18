# artcraft — DeepSeek Harness host

This directory adds a DeepSeek Harness host to the existing Agent Plugin. It does
not replace `plugin.json`, `mcp.json`, `hooks/`, or the other host manifests:
Claude Code, Codex, ZCode and Kimi keep using those.

## Install

Install the plugin repository, not the marketplace repository:

```sh
dsh plugin --profile desktop add https://github.com/full-aigc-plugins/artcraft-plugin.git
```

For local development, link this directory instead:

```sh
dsh plugin --profile desktop add link:./dsh
```

The marketplace repository (`full-aigc-plugins`) stores catalog metadata only and
does not declare a DSH bundle, so it cannot be installed as a plugin.

## What DSH gets

- every `skills/<name>/SKILL.md` (read live, no copy)
- the orchestration guidance that routes work to VectorCraft, PhotoCraft,
  EffectCraft and FilmCraft

ArtCraft has no editor and no MCP server of its own. Its domain plugins open their
editors in DSH's right Sidebar Browser through their own DSH hosts.
