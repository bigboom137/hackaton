# Questline home screen art

- `home-background.svg` is the dark-mode home background: a moonlit castle above a misty valley.
- `home-background-light.svg` is the light-mode version: the same scene by day.

Both are vector illustrations, so they stay sharp at any size. Each file covers every screen size; `css/styles.css` shifts the crop on tall phone screens (`background-position:80% center`) so the moon or sun and the castle stay in view. Which one is shown follows the Theme setting (System / Light / Dark).
- Logo (optional): `questline-logo.png`. If it is missing, the text title is shown instead. A transparent PNG around 1000 x 300 px works well.

To use your own backgrounds instead, drop images here and change the `url(...)` values in the `.title-screen` rules in `css/styles.css` (one for dark, two for light: the System and forced-Light rules). Images are cropped to fill the window, so about 1920 x 1080 px works well, with the important parts kept near the centre.

The mobile editor has a separate full-screen Preview mode, opened from the Preview button and exited with Editor.
