# ArtCraft — DeepSeek Harness host

This directory adds a DeepSeek Harness host to the existing Agent Plugin.
It does not replace `plugin.json`, `mcp.json`, `hooks/`, or any other
host manifest; Claude Code, Codex, ZCode and Kimi keep using those.

## Install

```sh
dsh plugin --profile desktop add link:/Users/wandl/workspaces/workspace-agent-skills/full-aigc-plugins-repositories/artcraft-plugin/dsh
```

## What DSH gets

- every `skills/<name>/SKILL.md` (read live; no copy)
- every `commands/*.json` as a user-invocable `/name` skill
- no MCP server in this plugin

Hooks have no DSH equivalent; the original `hooks/` files remain in place.
