/**
 * The mark (P10-10): the wordmark's "D", Fraunces at the wordmark's optical size and softness
 * (opsz 144, SOFT 100), at weight 700 so its stem still reads at 16 px. Its outline is taken from
 * the Fraunces font the app ships (SIL Open Font License), in font units: y points up, the
 * baseline is y = 0 and the cap height is 1400. `icon.svg` draws the same outline.
 */
export const MARK_PATH =
  'M53 84Q53 145 110 172L150 187Q177 200 187.5 218Q198 236 198 267L198 1133Q198 1164 187.5 1181.5Q177 1199 150 1213L111 1227Q53 1256 53 1317Q53 1358 77 1379Q101 1400 145 1400L666 1400Q839 1400 980.5 1345Q1122 1290 1224 1190.5Q1326 1091 1380.5 954Q1435 817 1435 655Q1435 466 1352.5 318.5Q1270 171 1117 85.5Q964 0 752 0L145 0Q101 0 77 21Q53 42 53 84ZM721 165Q823 165 901.5 221.5Q980 278 1025 389Q1070 500 1070 664Q1070 790 1040 895.5Q1010 1001 952.5 1077Q895 1153 815.5 1194Q736 1235 637 1235L554 1235L554 304Q554 230 585.5 197.5Q617 165 676 165L721 165Z';

/**
 * Where the outline sits in a 512-unit square: scaled to 340 units tall, flipped so y points down,
 * centred, with its baseline at y = 426. `icon.svg` uses the same transform.
 */
export const MARK_TRANSFORM = 'translate(75.3143 426) scale(0.2428571 -0.2428571)';

/** The outline's bounds, in the same units. */
export const MARK_BOX = { minX: 53, maxX: 1435, minY: 0, maxY: 1400 } as const;

/**
 * The two colours, as literal values, since an image can't read CSS variables: `--ink-0` and
 * `--ember-0` in `src/styles/tokens.css` (docs/DESIGN.md, section 1).
 */
export const MARK_COLOURS = { ink: 'rgb(10, 9, 8)', ember: 'rgb(227, 168, 87)' } as const;
