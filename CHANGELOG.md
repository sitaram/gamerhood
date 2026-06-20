# Changelog

## 2026-06-20

### Publishing & storefront
- Fixed the publish dead-end where new accounts hit a 400 error — they now automatically get a default storefront on signup.
- The publish flow now self-heals: if a storefront row is missing, it creates one instead of failing.
- Publish errors now appear right at the Publish button and auto-scroll into view, instead of being hidden in a banner at the top of the page.
- Rewrote the publish failure message in plain language for parents, removing the developer-facing "inspect the network tab" text.
- Moved "Start over" from the top of the Choose Your Merch step down to the bottom, so it's no longer easy to hit by mistake instead of Publish.
- Reorganized the cluttered publish-step buttons into two clear rows: the primary Publish action on top, secondary/destructive actions below.
- Added an "Add more products with this design" button on each listing's edit page, so you can publish more product types for an existing design without recreating it.

### Mockups (so the preview matches what actually prints)
- The storefront, listings, and product pages now show Printful's real rendered mockup instead of a browser-faked overlay that drifted off the product.
- We now copy Printful's mockup into our own storage, since Printful's original URLs expire after a few days and would break the images.
- The "Refresh from Printful" button on a listing now regenerates and backfills the real mockup, so existing listings can be fixed without re-publishing.
- Mockup images are now resized and served as WebP instead of full-resolution files, so the storefront loads much faster.

### Placement editor (lining up art on the merch)
- Rebuilt the interaction: you now drag the artwork itself to move it (1:1 with the cursor), and drag the corner dots to resize it proportionally.
- The selection box now wraps and follows the artwork, instead of being a fixed frame the art moved inside of.
- The artwork is now constrained to stay fully inside the printable area, so nothing can accidentally get cropped off.
- Clarified the visuals: the dashed frame is Printful's printable area, and the dashed box is your art.
- Removed the separate zoom slider, since the corner-dot resizing now handles sizing.
- Made the corner handles smaller, and fixed two bugs: dragging the art did nothing, and a blue tint washed over the canvas while resizing.
- Let the art scale down much smaller than before (minimum size lowered from 0.3 to 0.05) for small / left-chest-style placements.

### Merch picker (choosing which products)
- Replaced the cryptic "X/Y" counter with clearer labels: "N selected" when you've picked something, "N styles" / "1 option" when a category is collapsed.
- Unified all categories to behave identically: single-option ones (joggers, mug, pet sweater) now expand to show their preview tile just like multi-option ones, instead of toggling invisibly — so you always see the product, and the wording is consistent everywhere (no more "Added" vs "selected").

### Infrastructure / deploys
- Added a `.vercelignore` so deploys stop trying to upload ~950MB of build artifacts, which was stalling them.
- Updated the deploy scripts to use the globally-installed Vercel CLI, which works on machines behind the Socket Firewall.
- Documented the Socket-Firewall deploy workaround in `RELEASE.md` so it's not a mystery next time.
