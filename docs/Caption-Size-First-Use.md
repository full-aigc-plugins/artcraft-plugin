# Caption size on first use

Native testing reproduced three-pixel bright glyphs with size18 at height180. FilmCraft size is normalized to1080 lines. Small English templates now use size84 and margin0.02, yielding nominal14px. Caption text/timing, editing operations and output dimensions are preserved. Chinese and HD templates retain their configuration and require layout-specific review.

Each independent skill carries its own workflow reference with conversion, preview inspection and short-audio source bounds. No sibling skill is needed. Use size = desiredPixels × 1080 / frameHeight, rather than reusing84 for every resolution. Inspect the actual native preview/export because glyph bounds depend on the font. Never explicitly trim narration beyond its source; when omitting audio duration, check clip tail and sequence end.

The new Film single-skill pixel test uses real footage and two seconds of silent PCM for technical verification, with public installation into an empty cache. It does not establish voice quality or human acceptance. Art mixed first use additionally checks caption pixels, brand source revision, dependent rebuild and unrelated reuse. Source tests and plugin-installed acceptance are separate; candidate source results do not qualify a later immutable plugin.

[Evidence](evidence/caption-size-source-first-use-20261008.json). FullV1, every command, GUI, other platforms, human creative acceptance and generic Skills CLI installation remain open.
