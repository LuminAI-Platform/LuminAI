"""Production date and time cleaning, normalization, and validation engine.

Handles:
  - Calendar validity checking (e.g. Feb 31, Feb 30, April 31 are strictly invalid)
  - Two-digit year resolution with documented century boundary (<= 50 -> 2000s, > 50 -> 1900s)
  - Approximate or partial dates (e.g. "c. 2018", "2018 approx") preserved with precision metadata
  - Strict rejection of relative text or duration strings (e.g. "61 yrs", "Yesterday")
  - Ambiguous date detection (e.g. 03/04/2020) without silent guessing
  - Future date detection for historical events (e.g. birth dates)
  - Consistent ISO 8601 output representation while keeping original and precision
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


@dataclass
class DateCleanResult:
    """Outcome of cleaning and validating a date value."""
    is_valid: bool
    original_value: Any
    iso_date: Optional[str] = None
    is_partial: bool = False
    is_ambiguous: bool = False
    precision: str = "exact"  # "exact", "year", "year_month", "invalid"
    error: Optional[str] = None
    transformation: Optional[str] = None

    @property
    def standardized_iso(self) -> Optional[str]:
        return self.iso_date

    @property
    def calendar_valid(self) -> bool:
        return self.is_valid

    @property
    def validation_notes(self) -> str:
        return self.error or ""

    @property
    def metadata(self) -> Dict[str, Any]:
        if self.is_ambiguous:
            return {"interpretation_options": ["DD/MM/YYYY", "MM/DD/YYYY"]}
        return {}


class DateCleaner:
    """Production date parsing and validation engine."""

    # Century cutoff rule: <= 50 -> 2000s, > 50 -> 1900s
    CENTURY_CUTOFF_YEAR: int = 50

    @classmethod
    def _is_calendar_valid(cls, year: int, month: int, day: int) -> bool:
        """Strict calendar day-of-month validation (including leap years)."""
        if month < 1 or month > 12:
            return False
        if day < 1:
            return False
        max_days = calendar.monthrange(year, month)[1]
        return day <= max_days

    @classmethod
    def _resolve_two_digit_year(cls, yy: int) -> int:
        """Resolve two-digit year according to documented century boundary."""
        if yy <= cls.CENTURY_CUTOFF_YEAR:
            return 2000 + yy
        else:
            return 1900 + yy

    @classmethod
    def clean_date(
        cls,
        val: Any,
        field_name: Optional[str] = None,
        column_format_hint: Optional[str] = None,  # "DMY" or "MDY" if established
        disallow_future: bool = True,
        is_birth_date: bool = False,
    ) -> DateCleanResult:
        """Cleans and validates an individual date value.
        
        Never invents missing dates or silently guesses ambiguous calendar days.
        """
        if is_birth_date:
            field_name = field_name or "birth_date"
            disallow_future = True
        if val is None:
            return DateCleanResult(
                is_valid=True,
                original_value=val,
                iso_date=None,
                precision="exact",
            )

        # Already a Python date or datetime
        if isinstance(val, (date, datetime)):
            dt = val if isinstance(val, datetime) else datetime(val.year, val.month, val.day, tzinfo=timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Check future date if required
            if disallow_future and cls._is_historical_field(field_name):
                now = datetime.now(timezone.utc) + timedelta(days=1)
                if dt > now:
                    return DateCleanResult(
                        is_valid=False,
                        original_value=val,
                        iso_date=None,
                        error=f"Date '{dt.date().isoformat()}' is in the future for historical field '{field_name or 'date'}'",
                    )
            return DateCleanResult(
                is_valid=True,
                original_value=val,
                iso_date=dt.date().isoformat(),
                precision="exact",
            )

        # Numeric epoch timestamp check (e.g. 1716940800 or 1716940800000)
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            epoch_num = float(val)
            if epoch_num > 1e11:  # Milliseconds
                epoch_num /= 1000.0
            if 0 < epoch_num < 253402300799:  # Sensible epoch range
                try:
                    dt = datetime.fromtimestamp(epoch_num, tz=timezone.utc)
                    return DateCleanResult(
                        is_valid=True,
                        original_value=val,
                        iso_date=dt.date().isoformat(),
                        precision="exact",
                        transformation="epoch_timestamp_to_iso",
                    )
                except (ValueError, OverflowError):
                    pass

        s = str(val).strip()
        if not s or s.lower() in ("null", "none", "n/a", "na", "-", "?", "undefined", "#n/a"):
            return DateCleanResult(
                is_valid=True,
                original_value=val,
                iso_date=None,
                precision="exact",
            )

        # 1. Reject duration / relative strings
        if re.search(r"\b(yrs|years?|months?|days?|weeks?|yesterday|today|tomorrow|now)\b", s, re.IGNORECASE):
            return DateCleanResult(
                is_valid=False,
                original_value=val,
                iso_date=None,
                precision="invalid",
                error=f"Relative text or duration '{s}' is not a valid calendar date",
            )

        # 2. Check partial or approximate dates: "c. 2018", "circa 1995", "2018 (approx)", "c. 05/2018"
        approx_match = re.match(r"^(?:c\.|circa|approx\.?|about)?\s*(\d{4})\b(?:\s*\(approx\))?$", s, re.IGNORECASE)
        if approx_match:
            year_val = int(approx_match.group(1))
            if 1800 <= year_val <= 2100:
                return DateCleanResult(
                    is_valid=True,
                    original_value=val,
                    iso_date=str(year_val),
                    is_partial=True,
                    precision="year",
                    transformation="partial_year_extracted",
                )

        # Check year-month: "2018-05" or "05/2018"
        ym_match = re.match(r"^(\d{4})[-/.](\d{1,2})$", s)
        if ym_match:
            y, m = int(ym_match.group(1)), int(ym_match.group(2))
            if 1 <= m <= 12 and 1800 <= y <= 2100:
                return DateCleanResult(
                    is_valid=True,
                    original_value=val,
                    iso_date=f"{y:04d}-{m:02d}",
                    is_partial=True,
                    precision="year_month",
                    transformation="partial_year_month_extracted",
                )

        # Check ISO timestamp with time: e.g. "2024-04-20T10:30:00Z"
        if "t" in s.lower() or (":" in s and len(s) > 10):
            try:
                clean_iso = s.replace("Z", "+00:00").replace("z", "+00:00")
                parsed_dt = datetime.fromisoformat(clean_iso)
                if parsed_dt.tzinfo is None:
                    parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
                if disallow_future and cls._is_historical_field(field_name):
                    now = datetime.now(timezone.utc) + timedelta(days=1)
                    if parsed_dt > now:
                        return DateCleanResult(
                            is_valid=False,
                            original_value=val,
                            iso_date=None,
                            error=f"Date '{parsed_dt.date().isoformat()}' is in the future for historical field '{field_name or 'date'}'",
                        )
                return DateCleanResult(
                    is_valid=True,
                    original_value=val,
                    iso_date=parsed_dt.date().isoformat(),
                    precision="exact",
                    transformation="iso8601_parsed",
                )
            except Exception:
                pass

        # Check written month: "15 Jan 1990", "January 15, 1990", "15-Jan-1990"
        written_formats = [
            "%d %b %Y", "%d %B %Y",
            "%b %d, %Y", "%B %d, %Y",
            "%d-%b-%Y", "%d-%B-%Y",
            "%b %d %Y", "%B %d %Y",
        ]
        for wfmt in written_formats:
            try:
                parsed = datetime.strptime(s, wfmt)
                return DateCleanResult(
                    is_valid=True,
                    original_value=val,
                    iso_date=parsed.date().isoformat(),
                    precision="exact",
                    transformation="written_date_standardized",
                )
            except ValueError:
                continue

        # Standard numeric patterns:
        # Pattern 1: YYYY-MM-DD or YYYY/MM/DD
        iso_match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", s)
        if iso_match:
            y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
            if not cls._is_calendar_valid(y, m, d):
                return DateCleanResult(
                    is_valid=False,
                    original_value=val,
                    error=f"Invalid calendar date '{s}' (day {d} does not exist in month {m} of year {y})",
                )
            iso_str = f"{y:04d}-{m:02d}-{d:02d}"
            if disallow_future and cls._is_historical_field(field_name):
                now_date = datetime.now(timezone.utc).date() + timedelta(days=1)
                if date(y, m, d) > now_date:
                    return DateCleanResult(
                        is_valid=False,
                        original_value=val,
                        error=f"Future date '{iso_str}' is invalid for field '{field_name or 'date'}'",
                    )
            return DateCleanResult(
                is_valid=True,
                original_value=val,
                iso_date=iso_str,
                precision="exact",
                transformation="standardized_to_iso",
            )

        # Pattern 2: DD/MM/YYYY, MM/DD/YYYY, or two-digit year versions
        slash_match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$", s)
        if slash_match:
            part1 = int(slash_match.group(1))
            part2 = int(slash_match.group(2))
            raw_y = int(slash_match.group(3))

            # Resolve year if two digits
            y = cls._resolve_two_digit_year(raw_y) if raw_y < 100 else raw_y

            # Determine Day vs Month
            # Case A: part1 > 12 -> must be Day (DD/MM/YYYY)
            if part1 > 12 and part2 <= 12:
                d, m = part1, part2
            # Case B: part2 > 12 -> must be Day (MM/DD/YYYY)
            elif part2 > 12 and part1 <= 12:
                m, d = part1, part2
            # Case C: Both <= 12 -> Ambiguous date!
            elif part1 <= 12 and part2 <= 12:
                if part1 == part2:
                    m, d = part1, part2  # e.g. 05/05/1990 is unambiguously May 5th
                elif column_format_hint == "DMY":
                    d, m = part1, part2
                elif column_format_hint == "MDY":
                    m, d = part1, part2
                else:
                    # Do NOT silently guess ambiguous values without hint!
                    # Default: check if calendar valid both ways, flag as ambiguous
                    if not cls._is_calendar_valid(y, part2, part1) and cls._is_calendar_valid(y, part1, part2):
                        m, d = part1, part2
                    elif cls._is_calendar_valid(y, part2, part1) and not cls._is_calendar_valid(y, part1, part2):
                        d, m = part1, part2
                    else:
                        # Ambiguous: e.g. 03/04/2020 could be April 3 or March 4
                        # Preserving as ambiguous, providing DMY as default candidate but flagging is_ambiguous
                        d, m = part1, part2
                        iso_str = f"{y:04d}-{m:02d}-{d:02d}"
                        return DateCleanResult(
                            is_valid=True,
                            original_value=val,
                            iso_date=iso_str,
                            is_ambiguous=True,
                            precision="exact",
                            transformation=f"ambiguous_date_parsed_as_dmy_({s})",
                            error=f"Date '{s}' is ambiguous between DD/MM and MM/DD",
                        )
            else:
                return DateCleanResult(
                    is_valid=False,
                    original_value=val,
                    error=f"Invalid date format '{s}': both components > 12 ({part1}, {part2})",
                )

            # Validate calendar validity
            if not cls._is_calendar_valid(y, m, d):
                return DateCleanResult(
                    is_valid=False,
                    original_value=val,
                    error=f"Invalid calendar date '{s}' (day {d} does not exist in month {m} of year {y})",
                )

            iso_str = f"{y:04d}-{m:02d}-{d:02d}"
            if disallow_future and cls._is_historical_field(field_name):
                now_date = datetime.now(timezone.utc).date() + timedelta(days=1)
                if date(y, m, d) > now_date:
                    return DateCleanResult(
                        is_valid=False,
                        original_value=val,
                        error=f"Future date '{iso_str}' is invalid for field '{field_name or 'date'}'",
                    )

            return DateCleanResult(
                is_valid=True,
                original_value=val,
                iso_date=iso_str,
                precision="exact",
                transformation="normalized_to_iso",
            )

        return DateCleanResult(
            is_valid=False,
            original_value=val,
            error=f"Unrecognized or invalid date format '{s}'",
        )

    @classmethod
    def _is_historical_field(cls, field_name: Optional[str]) -> bool:
        """Determines if a field represents a past event that must never be in the future."""
        if not field_name:
            return False
        fn = field_name.lower().replace("_", "").replace("-", "")
        historical_keywords = [
            "dob", "birth", "birthday", "birthdate",
            "joined", "hire", "admission", "admitted",
            "registration", "registered", "created",
        ]
        return any(k in fn for k in historical_keywords)

    @classmethod
    def infer_column_date_format(cls, values: List[Any]) -> Optional[str]:
        """Examines non-ambiguous rows in a column to establish whether the column uses DMY or MDY."""
        dmy_votes = 0
        mdy_votes = 0

        for val in values:
            if not val:
                continue
            s = str(val).strip()
            m = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$", s)
            if m:
                p1, p2 = int(m.group(1)), int(m.group(2))
                if p1 > 12 and p2 <= 12:
                    dmy_votes += 1
                elif p2 > 12 and p1 <= 12:
                    mdy_votes += 1

        if dmy_votes > 0 and mdy_votes == 0:
            return "DMY"
        if mdy_votes > 0 and dmy_votes == 0:
            return "MDY"
        if dmy_votes > mdy_votes:
            return "DMY"
        if mdy_votes > dmy_votes:
            return "MDY"
        return None
