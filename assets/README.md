# Questline home screen art

- Dark-mode home background: `home-background.png` or `home-background.svg` (moonlit castle above a misty valley).
- Light-mode home background: `home-background-light.png` or `home-background-light.svg` (the same scene by day).

Both are vector illustrations, so they stay sharp at any size. Each file covers every screen size; `css/styles.css` shifts the crop on tall phone screens (`background-position:80% center`) so the moon or sun and the castle stay in view. Which one is shown follows the Theme setting (System / Light / Dark).
- Light logo: `questline-logo-light.png` or `questline-logo-light.svg` (used on dark backgrounds)
- Dark logo: `questline-logo-dark.png` or `questline-logo-dark.svg` (used on light backgrounds)

PNG files are preferred when present; the matching SVG is used as a fallback. Logo variants switch automatically with the System / Light / Dark theme setting. Transparent logos around 1000 x 300 px work well. If both formats for a logo are missing, the text title is shown instead. Backgrounds follow the same PNG-first, SVG-fallback behavior and switch with the theme setting.

To use your own backgrounds, place the PNGs or SVGs here with the filenames above. Images are cropped to fill the window, so about 1920 x 1080 px works well, with the important parts kept near the centre.

The mobile editor has a separate full-screen Preview mode, opened from the Preview button and exited with Editor.
