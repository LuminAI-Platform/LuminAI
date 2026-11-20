"""Production text encoding, sanitization, and corruption remediation engine.

Resolves:
  - Mojibake (e.g. 'MÃ¼ller' -> 'Müller', 'â€™' -> '’', 'FranÃ§ois' -> 'François')
  - Safe Unicode normalization (NFKC)
  - Control characters and zero-width spaces removal
  - Whitespace collapsing and trimming
  - HTML tag and script injection sanitization
  - CSV / Spreadsheet formula injection neutralization
  - Preservation of legitimate international characters, diacritics, and symbols
"""

from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Optional, Tuple


@dataclass
class TextCleanResult:
    """Outcome of text sanitization and repair."""
    cleaned_text: str
    original_text: str
    is_modified: bool
    repaired_mojibake: bool = False
    sanitized_html: bool = False
    neutralized_formula: bool = False
    removed_control_chars: bool = False

    @property
    def cleaned(self) -> str:
        return self.cleaned_text

    @property
    def mojibake_fixed(self) -> bool:
        return self.repaired_mojibake

    @property
    def html_stripped(self) -> bool:
        return self.sanitized_html

    @property
    def formula_neutralized(self) -> bool:
        return self.neutralized_formula


# Common Mojibake byte-level replacements
MOJIBAKE_MAP = {
    "Ã¼": "ü",
    "Ãœ": "Ü",
    "Ã¤": "ä",
    "Ã„": "Ä",
    "Ã¶": "ö",
    "Ã–": "Ö",
    "ÃŸ": "ß",
    "Ã©": "é",
    "Ã‰": "É",
    "Ã¨": "è",
    "Ãˆ": "È",
    "Ãª": "ê",
    "Ã¡": "á",
    "Ã ": "à",
    "Ã±": "ñ",
    "Ã‘": "Ñ",
    "Ã§": "ç",
    "Ã‡": "Ç",
    "Ã­": "í",
    "Ã³": "ó",
    "Ãº": "ú",
    "â€™": "’",
    "â€œ": "“",
    "â€": "”",
    "â€“": "–",
    "â€”": "—",
    "â€¦": "…",
    "Â©": "©",
    "Â®": "®",
    "â‚¬": "€",
}


class TextCleaner:
    """Production text sanitization and encoding repair engine."""

    # Control chars: 0x00 - 0x1F except \t (0x09), \n (0x0A), \r (0x0D); and zero-width chars
    CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b\u200c\u200d\ufeff]")

    # HTML tags / scripts
    HTML_TAG_REGEX = re.compile(r"<[^>]+>")

    @classmethod
    def repair_mojibake(cls, text: str) -> Tuple[str, bool]:
        """Detect and repair common UTF-8 double-encoding artifacts (mojibake)."""
        if not text:
            return text, False

        modified = False
        repaired = text

        # Step 1: Direct map replacement for common multi-byte mojibake sequences
        for bad, good in MOJIBAKE_MAP.items():
            if bad in repaired:
                repaired = repaired.replace(bad, good)
                modified = True

        # Step 2: Attempt cp1252 / latin-1 roundtrip decode if mojibake characters remain
        if "Ã" in repaired or "â" in repaired or "Â" in repaired:
            try:
                # Attempt decoding as cp1252 re-interpreted as utf-8
                candidate = repaired.encode("cp1252").decode("utf-8")
                # Ensure candidate didn't corrupt legitimate characters
                if len(candidate) <= len(repaired) and not any(c in candidate for c in ("Ã", "â", "Â")):
                    return candidate, True
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        return repaired, modified

    @classmethod
    def sanitize_html(cls, text: str) -> Tuple[str, bool]:
        """Safely strip HTML tags and decode HTML entities."""
        if not text:
            return text, False

        modified = False
        # Unescape HTML entities (e.g. &amp;, &lt;, &gt;)
        unescaped = html.unescape(text)
        if unescaped != text:
            modified = True

        # Strip HTML tags like <script>...</script> or <p>...</p>
        if "<" in unescaped and ">" in unescaped:
            stripped = cls.HTML_TAG_REGEX.sub("", unescaped)
            if stripped != unescaped:
                return stripped, True

        return unescaped, modified

    @classmethod
    def neutralize_formula(cls, text: str) -> Tuple[str, bool]:
        """Neutralizes CSV / Spreadsheet formula injection (=, @, +, - followed by text/calls).
        
        Preserves legitimate numeric signs (e.g. -42, +1555).
        """
        if not text:
            return text, False

        s = text.strip()
        if len(s) == 0:
            return text, False

        # If starts with =, @, or (+ / - followed by letters/functions/pipes/quotes)
        if s.startswith("=") or s.startswith("@"):
            return "'" + s, True

        if s.startswith("+") or s.startswith("-"):
            rest = s[1:].strip()
            # If rest is purely numeric, it's a legitimate number or phone number
            if not re.match(r"^\d+(\.\d+)?$", rest.replace(",", "")):
                # Contains letters, commands, cmd|, powershell, etc.
                if re.search(r"[a-zA-Z\|\(\)\'\"]", rest):
                    return "'" + s, True

        return text, False

    @classmethod
    def clean_text(
        cls,
        val: Any,
        field_type: str = "text",
        collapse_spaces: bool = True,
    ) -> TextCleanResult:
        """Cleans and standardizes text value."""
        if val is None:
            return TextCleanResult(cleaned_text="", original_text="", is_modified=False)

        raw = str(val)
        current = raw
        is_modified = False

        # Step 1: Repair mojibake BEFORE NFKC decomposes Latin-1/cp1252 byte artifacts
        repaired, did_mojibake = cls.repair_mojibake(current)
        if did_mojibake:
            is_modified = True
            current = repaired

        # Step 2: Unicode normalization (NFKC)
        normalized = unicodedata.normalize("NFKC", current)
        if normalized != current:
            is_modified = True
            current = normalized

        # Step 3: Remove unwanted control chars and zero-width spaces
        removed_control = False
        if cls.CONTROL_CHAR_REGEX.search(current):
            current = cls.CONTROL_CHAR_REGEX.sub("", current)
            removed_control = True
            is_modified = True

        # Step 4: Sanitize HTML if present
        sanitized_html = False
        current, did_html = cls.sanitize_html(current)
        if did_html:
            sanitized_html = True
            is_modified = True

        # Step 5: Whitespace normalization
        if collapse_spaces:
            # Collapse multiple spaces, tabs, and newlines into single spaces
            collapsed = re.sub(r"[ \t]+", " ", current).strip()
            if collapsed != current:
                is_modified = True
                current = collapsed
        else:
            stripped = current.strip()
            if stripped != current:
                is_modified = True
                current = stripped

        # Step 6: Neutralize formula injection
        current, neutralized_formula = cls.neutralize_formula(current)
        if neutralized_formula:
            is_modified = True

        return TextCleanResult(
            cleaned_text=current,
            original_text=raw,
            is_modified=is_modified,
            repaired_mojibake=did_mojibake,
            sanitized_html=sanitized_html,
            neutralized_formula=neutralized_formula,
            removed_control_chars=removed_control,
        )
