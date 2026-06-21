# Changelog

## 2026-06-20

### Publishing & storefront
- Fixed the publish dead-end where new accounts hit a 400 error — they now automatically get a default storefront on signup.
- The publish flow now self-heals: if a storefront row is missing, it creates one instead of failing.
- Publish errors now appear right at the Publish button and auto-scroll into view, instead of being hidden in a banner at the top of the page.
- Rewrote the publish failure message in plain language for parents, removing the developer-facing "inspect the network tab" text.
- Moved "Start over" from the top of the Choose Your Merch step down to the bottom, so it's no longer easy to hit by mistake instead of Publish.
- Reorganized the cluttered publish-step buttons into two clear rows: the primary Publish action on top, secondary/destructive actions below.

### Adding more products to an existing design
- Added an "Add more products with this design" button on each listing's edit page, so you can publish more product types for an existing design without recreating it.
- Added a per-card "Add more" button on the listings page itself, so it's reachable without opening a listing first.

### Mockups — making the preview match the print
- The storefront grid now shows Printful's real rendered mockup instead of a browser-faked overlay that drifted off the product.
- Made the dashboard listings page prefer the real mockup too (it was still forced to use the old browser overlay).
- Made the listing edit page prefer the real mockup too.
- Made the product detail page show the real mockup for the published color (other colors still composite live).
- We now copy Printful's mockup into our own storage, since Printful's original URLs expire after a few days and would break the images.
- The "Refresh from Printful" button regenerates and backfills the real mockup, and now reports whether a mockup was actually produced (and the reason if not).
- Mockup images are now resized and served as WebP instead of full-resolution files, so the storefront loads much faster.

### Print accuracy & artwork handling
- Uploaded designs are now trimmed of their transparent padding before printing, so the artwork is centered in the print area instead of floating off in a corner. (`trimPrintMargins` existed but was never being called.)
- Added a guard against non-inch print-area values (some product lines like knitwear/embroidery report dimensions in other units, leaking absurd values like 784×599) that were corrupting the placement math and the "prints at N inches" size readout — these now fall back to the catalog default.

### Placement editor (lining up art on the merch)
- Rebuilt the interaction: you now drag the artwork itself to move it (1:1 with the cursor) instead of nudging it slowly.
- Added corner handles that resize the art proportionally (no distortion).
- The selection box now wraps and follows the artwork, instead of being a fixed frame the art moved inside of.
- The artwork can be pushed past the printable frame on purpose for a bleed/crop — the part outside the cyan frame simply won't print.
- Clarified the visuals: the dashed cyan frame is Printful's printable area, and the dashed box is your art.
- Removed the separate zoom slider, since the corner-dot resizing now handles sizing.
- Made the corner handles smaller.
- Fixed a bug where dragging the art did nothing (it inherited a "not clickable" state from its container).
- Fixed a bug where a blue tint washed over the canvas while resizing (browser text-selection during the drag).
- Let the art scale down much smaller than before (minimum size lowered from 0.3 to 0.05) for small / left-chest-style placements.

### Merch picker (choosing which products)
- Replaced the cryptic "X/Y" counter with a clear "N selected" pill once you've picked something.
- Categories show a consistent count when collapsed ("1 style" / "N styles") and expand to reveal their preview tile(s); selection is by tapping a tile, the same for one-option and multi-option categories.
- Made the "selected" status pill look identical across all categories.

### Infrastructure / deploys
- Added a `.vercelignore` so deploys stop trying to upload ~950MB of build artifacts, which was stalling them.
- Updated the deploy scripts to use the globally-installed Vercel CLI, which works on machines behind the Socket Firewall.
- Documented the Socket-Firewall deploy workaround in `RELEASE.md` so it's not a mystery next time.

### Known issues / in progress
- Real Printful mockups still aren't generating for some products at publish time, so those listings fall back to the (less accurate) live-composited preview. The "Refresh from Printful" button now surfaces the exact failure reason to help diagnose this.
- Knitwear / embroidery / sublimation items (e.g., the pet sweater) don't fit the DTG "place a logo on a print area" model and currently render incorrectly — they likely need a separate flow or to be hidden until supported.
