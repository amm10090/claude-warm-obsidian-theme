# Claude Warm

<p align="center">
  <img src="screenshot.png" alt="Claude Warm preview" width="720">
</p>

<p align="center">
  <a href="https://community.obsidian.md/themes/claude-warm"><img alt="Obsidian Community Theme" src="https://img.shields.io/badge/Obsidian-Community%20Theme-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white"></a>
  <a href="https://github.com/amm10090/claude-warm-obsidian-theme/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/amm10090/claude-warm-obsidian-theme?style=for-the-badge&label=Release&color=B7791F"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-2A2B2A?style=for-the-badge"></a>
</p>

<p align="center">
  <img alt="Light palette" src="https://img.shields.io/badge/Light-Ivory%20%23F8F7F2-F8F7F2?style=flat-square&labelColor=3F3A2F&color=F8F7F2">
  <img alt="Dark palette" src="https://img.shields.io/badge/Dark-Charcoal%20%232A2B2A-2A2B2A?style=flat-square&labelColor=F8F7F2&color=2A2B2A">
  <img alt="Accent palette" src="https://img.shields.io/badge/Accent-Warm%20Gold%20%23B7791F-B7791F?style=flat-square&labelColor=2A2B2A&color=B7791F">
</p>

A warm, quiet theme for Obsidian with soft ivory surfaces, charcoal depth, and a restrained warm-gold accent system.

Claude Warm is inspired by Claude's calm, low-contrast interface: comfortable enough for long writing sessions, structured enough for dense vaults, and polished enough for a professional workspace.

## Design language

| Surface | Direction |
| --- | --- |
| Backgrounds | Soft ivory in light mode, layered charcoal in dark mode |
| Text | Warm ink and soft cream for comfortable reading contrast |
| Accents | Muted gold for links, tags, selections, and focused controls |
| Shapes | Rounded panes, gentle borders, and quiet shadows |

## Features

- Light and dark color schemes tuned as a matched pair
- Warm backgrounds with restrained contrast for long-form reading and editing
- Warm-gold accents for links, tags, selections, and focused controls
- Softer sidebars, tabs, menus, modals, tables, callouts, and code blocks
- Alternate task checkboxes for the community status syntax, in Live Preview and reading view
- No remote fonts or external assets in the theme CSS

## Install

### From Obsidian

Claude Warm is available in the Obsidian community theme directory:

<p>
  <a href="https://community.obsidian.md/themes/claude-warm"><img alt="Open community page" src="https://img.shields.io/badge/Open-Community%20Page-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white"></a>
  <a href="obsidian://show-theme?name=Claude%20Warm"><img alt="Open in Obsidian" src="https://img.shields.io/badge/Open%20in-Obsidian-2A2B2A?style=for-the-badge&logo=obsidian&logoColor=white"></a>
</p>

To install from Obsidian:

1. Open Obsidian Settings.
2. Go to `Appearance`.
3. Next to `Themes`, click `Manage`.
4. Search for `Claude Warm` and click `Use`.

### Manually

1. Create a folder named `Claude Warm` in your vault at `.obsidian/themes/`.
2. Copy `manifest.json` and `theme.css` into that folder.
3. Restart Obsidian.
4. Go to `Settings -> Appearance -> Themes` and choose `Claude Warm`.

## Alternate checkboxes

Task markers other than a blank box or `x` pick up the community alternate-checkbox syntax used by Minimal and the [Alternative Checkboxes Reference Set](https://github.com/damiankorcz/Alternative-Checkboxes-Reference-Set). The marks are original drawings in the Claude Warm palette. The theme does not include Lucide, Heroicons, or other third-party icon artwork.

Reading view and Live Preview both show the mark. Source mode keeps the characters as typed. `- [ ]`, `- [x]`, and `- [X]` stay the theme's normal checkbox.

| Syntax | Meaning |
| --- | --- |
| `- [ ]` | To-do |
| `- [x]`, `- [X]` | Done |
| `- [/]` | Incomplete |
| `- [-]` | Canceled |
| `- [>]` | Forwarded |
| `- [<]` | Scheduling |
| `- [?]` | Question |
| `- [!]` | Important |
| `- [*]` | Star |
| `- ["]` | Quote |
| `- [l]` | Location |
| `- [b]` | Bookmark |
| `- [i]` | Information |
| `- [S]` | Savings |
| `- [I]` | Idea |
| `- [p]` | Pros |
| `- [c]` | Cons |
| `- [f]` | Fire |
| `- [k]` | Key |
| `- [w]` | Win |
| `- [u]` | Up |
| `- [d]` | Down |

Canceled tasks are muted and struck through. The other statuses keep normal task text and change only the checkbox.

These rules are wrapped in a style query on `--theme-alternative-checkboxes`. They apply while that variable is `enable` (the theme default). The Reference Set snippet sets it to `disable`, so that snippet still replaces the built-in marks. A snippet of your own can do the same:

```css
body {
  --theme-alternative-checkboxes: disable;
}
```

The style query needs a current Obsidian installer. On an older WebView the extra statuses fall back to the normal checked checkbox. Plain to-do and done checkboxes do not depend on it.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#F8F7F2`, `hsl(51, 28%, 95%)` | `#2A2B2A`, `#2D2E2D` |
| Text | `hsl(47, 15%, 25%)` | `hsl(50, 14%, 91%)` |
| Accent | `#B7791F` | `#E6BF7A` |
| Code accent | `#B7791F` | `#E6BF7A` |

## Development

Claude Warm keeps the source intentionally small. Most of the theme is built from Obsidian CSS variables, with a few light selectors for surfaces that need a softer shape.

Files worth knowing:

| File | Purpose |
| --- | --- |
| `theme.css` | Theme source |
| `manifest.json` | Obsidian theme manifest |
| `versions.json` | Theme version to minimum Obsidian version map |
| `screenshot.png` | Community theme preview image |

Run the local validator before release:

```bash
node scripts/validate-theme.mjs
```

Regenerate the 512 x 288 preview image:

```bash
node scripts/generate-screenshot.mjs
```

## Release

Releases are created by GitHub Actions when a version tag is pushed.

1. Update `manifest.json` and `versions.json` to the new version.
2. Commit the change.
3. Create and push a tag that exactly matches `manifest.json`, for example:

```bash
git tag 1.0.0
git push origin 1.0.0
```

4. GitHub Actions creates a draft release and uploads `manifest.json` and `theme.css`.
5. Review the generated release notes, then publish the draft.

## Feedback

Issues and pull requests are welcome. Screenshots are especially helpful for UI bugs, since many theme problems depend on plugins, panes, and operating system settings.

## License

MIT
