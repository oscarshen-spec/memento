# Scrap Selection Toolbar — Design Spec
Date: 2026-04-01

## Summary
When a scrap on the canvas is tapped, it enters a selected state and the toolbar in the top bar swaps to show three context actions. Tapping empty canvas deselects and restores the default toolbar.

## State Changes

**App.tsx** gains:
- `selectedScrapId: string | null` (initially `null`)

`Scrapbook` loses its internal `selectedId` state. Instead it accepts two new props:
- `selectedScrapId: string | null`
- `onSelectScrap: (id: string | null) => void`

## Toolbar Swap

When `selectedScrapId !== null`, the top bar replaces the tape/text/glue buttons with:
1. **Scissors** — represents "cut" (no-op placeholder)
2. **Torn-paper** — represents "tear" (no-op placeholder)
3. **Trash** — represents "delete & return to drawer" (no-op placeholder)

When `selectedScrapId === null`, the default tape/text/glue toolbar is shown.

## Deselect

`checkDeselect` in `Scrapbook` calls `onSelectScrap(null)` on empty canvas tap (replaces `setSelectedId(null)`).

## Out of Scope (deferred)
- Actual cut, tear, and delete functionality — icons are placeholders only.
