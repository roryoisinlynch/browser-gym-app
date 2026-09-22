import medalGold from "../assets/emoji/medal-gold.svg?inline";
import medalSilver from "../assets/emoji/medal-silver.svg?inline";
import medalBronze from "../assets/emoji/medal-bronze.svg?inline";
import flagWhite from "../assets/emoji/flag-white.svg?inline";
import faceStarStruck from "../assets/emoji/face-star-struck.svg?inline";
import faceSlightlySmiling from "../assets/emoji/face-slightly-smiling.svg?inline";
import faceNeutral from "../assets/emoji/face-neutral.svg?inline";
import faceSlightlyFrowning from "../assets/emoji/face-slightly-frowning.svg?inline";
import faceClown from "../assets/emoji/face-clown.svg?inline";
import bullseye from "../assets/emoji/bullseye.svg?inline";
import "./EmojiGlyph.css";

/**
 * Artwork for every emoji the app prints, keyed by the character with any
 * variation selector stripped. Noto Emoji, Apache 2.0: see
 * src/assets/emoji/README.md for provenance and the file list.
 */
const ART: Record<string, string> = {
  "🥇": medalGold,
  "🥈": medalSilver,
  "🥉": medalBronze,
  "🏳": flagWhite,
  "🤩": faceStarStruck,
  "🙂": faceSlightlySmiling,
  "😐": faceNeutral,
  "🙁": faceSlightlyFrowning,
  "🤡": faceClown,
  "🎯": bullseye,
};

/** U+FE0F asks a font for emoji presentation; it is not part of the glyph. */
const VARIATION_SELECTOR = /️/g;

interface EmojiGlyphProps {
  /** The character the app would otherwise print as text. */
  emoji: string;
  /**
   * What a screen reader says. Leave it out where the parent already carries
   * a label; the picture is then decorative and read by nothing.
   */
  label?: string;
  className?: string;
}

/**
 * Draws an emoji from artwork the app ships instead of the phone's emoji font.
 *
 * A phone draws text emoji with whichever emoji font it carries, and that font
 * can be a bitmap. Stretched to the week hero's 168px face, a bitmap looks like
 * an upscaled thumbnail. Chrome on the author's Samsung drew the web's emoji
 * from Google's vector Noto font, sharp at any size, until a One UI update in
 * September 2026; after it, every large emoji came out blurred. These SVGs are
 * that same Noto artwork, so the look is unchanged and no longer depends on
 * what the phone happens to ship.
 *
 * Sized by the surrounding font-size, exactly like the text it replaces, so
 * each caller's existing font-size keeps working. Anything without artwork
 * falls back to the text glyph.
 */
export default function EmojiGlyph({ emoji, label, className }: EmojiGlyphProps) {
  const src = ART[emoji.replace(VARIATION_SELECTOR, "")];
  if (!src) {
    return label ? (
      <span className={className} role="img" aria-label={label}>
        {emoji}
      </span>
    ) : (
      <>{emoji}</>
    );
  }
  return (
    <img
      className={className ? `emoji-glyph ${className}` : "emoji-glyph"}
      src={src}
      alt={label ?? ""}
      draggable={false}
    />
  );
}
