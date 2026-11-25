"""
Deliberate defect injection rules, clean domain vocabularies, and dependency-free writers
for the LuminAI Data Engine validation suite.

This module MUST NEVER import any code from `data-engine/app/`.
"""

from __future__ import annotations

import csv
import io
import json
import random
import re
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence
from xml.sax.saxutils import escape

import pyarrow as pa
import pyarrow.parquet as pq

# ---------------------------------------------------------------------------
# Controlled Messy Vocabularies & Defect Payloads
# ---------------------------------------------------------------------------

NULL_SENTINEL_STRINGS: tuple[str, ...] = (
    "",
    "   ",
    "N/A",
    "n/a",
    "null",
    "NULL",
    "None",
    "--",
    "?",
    "nan",
    "NaN",
)

GHANA_CITIES: tuple[tuple[str, str, float, float], ...] = (
    ("Accra", "Greater Accra", 5.6037, -0.1870),
    ("Kumasi", "Ashanti", 6.6885, -1.6244),
    ("Tema", "Greater Accra", 5.6698, -0.0166),
    ("Takoradi", "Western", 4.8845, -1.7554),
    ("Tamale", "Northern", 9.4034, -0.8424),
    ("Madina", "Greater Accra", 5.6685, -0.1667),
    ("Cape Coast", "Central", 5.1315, -1.2795),
    ("Ho", "Volta", 6.6008, 0.4713),
)

INTERNATIONAL_CITIES: tuple[tuple[str, str, str, float, float], ...] = (
    ("United Kingdom", "Greater London", "London", 51.5072, -0.1276),
    ("United States", "New York", "New York", 40.7128, -74.0060),
    ("Nigeria", "Lagos", "Lagos", 6.5244, 3.3792),
    ("Kenya", "Nairobi", "Nairobi", -1.2921, 36.8219),
    ("Germany", "Berlin", "Berlin", 52.5200, 13.4050),
    ("Canada", "Ontario", "Toronto", 43.6532, -79.3832),
)

GHANA_FIRST_NAMES: tuple[str, ...] = (
    "Kwame", "Abena", "Kofi", "Akosua", "Yaw", "Ama", "Kojo", "Esi",
    "Kwesi", "Adjoa", "Fiifi", "Efua", "Nana", "Araba", "Kwadwo", "Akua",
)

GHANA_LAST_NAMES: tuple[str, ...] = (
    "Mensah", "Boateng", "Osei", "Appiah", "Owusu", "Asante", "Amoah",
    "Danso", "Nkrumah", "Baffour", "Osei-Mensah", "Adusei", "Frimpong", "Tetteh",
)

SMART_CASE_NAMES: tuple[str, ...] = (
    "Donald McDonald",
    "Seamus O'Connor",
    "Jan van der Beek",
    "Patrick MacAllister",
    "Kwame Osei-Mensah",
    "de Vries, Hendrik",
    "McCarthy, Siobhan",
)

NICKNAME_PAIRS: tuple[tuple[str, str], ...] = (
    ("William", "Bill"),
    ("Robert", "Bob"),
    ("Margaret", "Peggy"),
    ("Elizabeth", "Beth"),
    ("Joseph", "Joe"),
    ("Michael", "Mike"),
)

COUNTRY_MESSY_GHANA: tuple[str, ...] = ("Ghana", "ghana", "GHANA", "gh", "gha", "  Ghana  ")
COUNTRY_MESSY_UK: tuple[str, ...] = ("United Kingdom", "uk", "UK", "Great Britain", "  uk  ")
COUNTRY_MESSY_US: tuple[str, ...] = ("United States", "usa", "USA", "us", "United States of America")

GENDER_MESSY_MALE: tuple[str, ...] = ("Male", "male", "M", "m", "  male  ")
GENDER_MESSY_FEMALE: tuple[str, ...] = ("Female", "female", "F", "f", "  FEMALE ")
GENDER_INVALID: tuple[str, ...] = ("1", "0", "3", "unknown_code")

STATUS_MESSY: tuple[str, ...] = (
    "ACTIVE", "active", " Active ", "INACTIVE", "inactive", "PENDING", "pending", "Suspended",
)

INVALID_DATE_STRINGS: tuple[str, ...] = (
    "2024-02-30",
    "2023-04-31",
    "2035-08-19",
    "2099-01-01",
    "1900-13-45",
    "not-a-date",
)

INVALID_EMAIL_STRINGS: tuple[str, ...] = (
    "no-at-sign.com",
    "alice@nodot",
    "@missinguser.com",
    "user@.com",
    "bad space@example.com",
)

FORMULA_INJECTION_PAYLOADS: tuple[str, ...] = (
    "=CMD|' /C calc'!A0",
    "@SUM(1+1)",
    "+1+1",
    "-2+3",
    "\t=1+1",
    "=HYPERLINK(\"http://invalid.local\",\"click\")",
)

SQLI_TEST_PAYLOADS: tuple[str, ...] = (
    "'; DROP TABLE golden_records; --",
    "1' OR '1'='1",
    "admin'--",
    "x\"; DELETE FROM customers; --",
)

XSS_TEST_PAYLOADS: tuple[str, ...] = (
    "<script>alert('xss')</script>Kwame",
    "<img src=x onerror=alert(1)>Abena",
    "<b>Priority</b> & Care",
    "x < y and y > z",
)

MOJIBAKE_NAMES: tuple[str, ...] = (
    "RenÃ©e Mensah",
    "CafÃ© Accra",
    "JosÃ© Boateng",
    "NÃ¼rnberg Office",
)


def format_date_messy(dt: date, rng: random.Random) -> str:
    """Render a valid calendar date into inconsistent enterprise string representations."""
    style = rng.choice((0, 1, 2, 3, 4, 5))
    if style == 0:
        return dt.strftime("%Y-%m-%d")
    if style == 1:
        return dt.strftime("%d/%m/%Y")
    if style == 2:
        return dt.strftime("%d %b %Y")
    if style == 3:
        return dt.strftime("%Y/%m/%d")
    if style == 4:
        return f"{dt.isoformat()}T10:30:00Z"
    return f"{dt.isoformat()}T12:30:00+02:00"


def format_currency_messy(amount: float, currency: str, rng: random.Random) -> str:
    """Format a financial amount across mixed symbols, ISO prefixes, and thousand separators."""
    sym_map = {"USD": "$", "EUR": "€", "GBP": "£", "GHS": "GH₵"}
    sym = sym_map.get(currency, "$")
    sign = "-" if amount < 0 else ""
    abs_val = abs(amount)
    mode = rng.choice((0, 1, 2))
    if mode == 0:
        return f"{sign}{sym}{abs_val:,.2f}"
    if mode == 1:
        return f"{currency} {amount:,.2f}"
    return f"{sign}{sym}{abs_val:.2f}"


# ---------------------------------------------------------------------------
# Corruption Manifest Recorder (Bounded Sample + Exact Counts)
# ---------------------------------------------------------------------------

class CorruptionManifest:
    """Records exact counts of planted defects plus bounded inspection examples."""

    def __init__(self, domain: str, tier: str, max_samples: int = 120) -> None:
        self.domain = domain
        self.tier = tier
        self.max_samples = max_samples
        self.counts: Dict[str, int] = {}
        self.column_counts: Dict[str, Dict[str, int]] = {}
        self.samples: List[Dict[str, Any]] = []

    def record(
        self,
        row_index: int,
        column: str,
        category: str,
        clean_value: Any,
        corrupt_value: Any,
        expected_behavior: str,
    ) -> None:
        self.counts[category] = self.counts.get(category, 0) + 1
        col_map = self.column_counts.setdefault(column, {})
        col_map[category] = col_map.get(category, 0) + 1
        if len(self.samples) < self.max_samples:
            self.samples.append(
                {
                    "row_index": row_index,
                    "column": column,
                    "category": category,
                    "clean_value": clean_value,
                    "corrupt_value": repr(corrupt_value) if isinstance(corrupt_value, float) else corrupt_value,
                    "expected_behavior": expected_behavior,
                }
            )

    def to_dict(self, total_clean_rows: int, total_output_rows: int) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "tier": self.tier,
            "total_clean_rows": total_clean_rows,
            "total_output_rows": total_output_rows,
            "total_defects_injected": sum(self.counts.values()),
            "defect_counts_by_category": dict(sorted(self.counts.items())),
            "defect_counts_by_column": self.column_counts,
            "sample_records": self.samples,
        }


# ---------------------------------------------------------------------------
# Dependency-Free Multi-Format Writers (CSV, TSV, cp1252, BOM+;, JSON, NDJSON, Parquet, XLSX)
# ---------------------------------------------------------------------------

_XML_ILLEGAL_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]")


def _sanitize_xml_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = _XML_ILLEGAL_RE.sub("", text)
    return escape(text)


def _col_letter(idx_0: int) -> str:
    result = []
    n = idx_0 + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result.append(chr(65 + rem))
    return "".join(reversed(result))


def write_minimal_xlsx(path: Path, headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> int:
    """
    Write a valid OOXML `.xlsx` spreadsheet using only Python stdlib `zipfile`.
    Compatible with Polars + `fastexcel` without requiring openpyxl/xlsxwriter.
    Returns number of data rows written.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet_lines: List[str] = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetData>",
    ]

    # Header row
    hdr_cells = [
        f'<c r="{_col_letter(c)}1" t="inlineStr"><is><t xml:space="preserve">{_sanitize_xml_text(h)}</t></is></c>'
        for c, h in enumerate(headers)
    ]
    sheet_lines.append(f'<row r="1">{"".join(hdr_cells)}</row>')

    row_count = 0
    for r_idx, row in enumerate(rows, start=2):
        row_count += 1
        cells: List[str] = []
        for c_idx, val in enumerate(row):
            ref = f"{_col_letter(c_idx)}{r_idx}"
            if val is None:
                continue
            if isinstance(val, bool):
                cells.append(f'<c r="{ref}" t="b"><v>{1 if val else 0}</v></c>')
            elif isinstance(val, (int, float)):
                import math
                if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                    cells.append(f'<c r="{ref}" t="inlineStr"><is><t>NaN</t></is></c>')
                else:
                    cells.append(f'<c r="{ref}"><v>{val}</v></c>')
            else:
                cells.append(
                    f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{_sanitize_xml_text(val)}</t></is></c>'
                )
        sheet_lines.append(f'<row r="{r_idx}">{"".join(cells)}</row>')

    sheet_lines.append("</sheetData></worksheet>")

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<sheets><sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\"/></sheets>"
        "</workbook>"
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        "</styleSheet>"
    )

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/styles.xml", styles)
        zf.writestr("xl/worksheets/sheet1.xml", "\n".join(sheet_lines))

    return row_count


def _json_safe(val: Any) -> Any:
    import math
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    return val


class StreamingMultiWriter:
    """
    Streams record chunks to CSV, NDJSON, optional TSV/JSON array, and Parquet
    with bounded RAM footprint.
    """

    def __init__(
        self,
        headers: Sequence[str],
        csv_path: Optional[Path] = None,
        tsv_path: Optional[Path] = None,
        ndjson_path: Optional[Path] = None,
        json_array_path: Optional[Path] = None,
        json_array_limit: Optional[int] = None,
        parquet_path: Optional[Path] = None,
        parquet_schema: Optional[pa.Schema] = None,
    ) -> None:
        self.headers = list(headers)
        self._csv_fp = None
        self._csv_writer = None
        self._tsv_fp = None
        self._tsv_writer = None
        self._ndjson_fp = None
        self._json_fp = None
        self._json_first = True
        self._json_count = 0
        self._json_limit = json_array_limit
        self._pq_writer: Optional[pq.ParquetWriter] = None
        self._pq_schema = parquet_schema

        if csv_path is not None:
            csv_path.parent.mkdir(parents=True, exist_ok=True)
            self._csv_fp = open(csv_path, "w", newline="", encoding="utf-8")
            self._csv_writer = csv.writer(self._csv_fp)
            self._csv_writer.writerow(self.headers)

        if tsv_path is not None:
            tsv_path.parent.mkdir(parents=True, exist_ok=True)
            self._tsv_fp = open(tsv_path, "w", newline="", encoding="utf-8")
            self._tsv_writer = csv.writer(self._tsv_fp, delimiter="\t")
            self._tsv_writer.writerow(self.headers)

        if ndjson_path is not None:
            ndjson_path.parent.mkdir(parents=True, exist_ok=True)
            self._ndjson_fp = open(ndjson_path, "w", encoding="utf-8")

        if json_array_path is not None:
            json_array_path.parent.mkdir(parents=True, exist_ok=True)
            self._json_fp = open(json_array_path, "w", encoding="utf-8")
            self._json_fp.write("[\n")

        if parquet_path is not None:
            parquet_path.parent.mkdir(parents=True, exist_ok=True)
            self._parquet_path = parquet_path
        else:
            self._parquet_path = None

    def write_chunk(self, records: List[Dict[str, Any]]) -> None:
        if not records:
            return

        if self._csv_writer is not None:
            self._csv_writer.writerows([row.get(h) for h in self.headers] for row in records)

        if self._tsv_writer is not None:
            self._tsv_writer.writerows([row.get(h) for h in self.headers] for row in records)

        if self._ndjson_fp is not None:
            for row in records:
                clean = {k: _json_safe(row.get(k)) for k in self.headers}
                self._ndjson_fp.write(json.dumps(clean, ensure_ascii=False) + "\n")

        if self._json_fp is not None:
            for row in records:
                if self._json_limit is not None and self._json_count >= self._json_limit:
                    break
                clean = {k: _json_safe(row.get(k)) for k in self.headers}
                prefix = "  " if self._json_first else ",\n  "
                self._json_first = False
                self._json_fp.write(prefix + json.dumps(clean, ensure_ascii=False))
                self._json_count += 1

        if self._parquet_path is not None:
            pq_rows = []
            for row in records:
                pq_row = {}
                for h in self.headers:
                    v = row.get(h)
                    # Avoid mixed Arrow type inference crash by respecting explicit schema or stringifying non-scalar
                    if self._pq_schema is not None:
                        field_type = self._pq_schema.field(h).type
                        if pa.types.is_string(field_type) and v is not None and not isinstance(v, str):
                            v = str(v)
                    pq_row[h] = v
                pq_rows.append(pq_row)
            table = pa.Table.from_pylist(pq_rows, schema=self._pq_schema)
            if self._pq_writer is None:
                self._pq_writer = pq.ParquetWriter(self._parquet_path, table.schema, compression="snappy")
            self._pq_writer.write_table(table)

    def close(self) -> None:
        if self._csv_fp is not None:
            self._csv_fp.close()
        if self._tsv_fp is not None:
            self._tsv_fp.close()
        if self._ndjson_fp is not None:
            self._ndjson_fp.close()
        if self._json_fp is not None:
            self._json_fp.write("\n]\n")
            self._json_fp.close()
        if self._pq_writer is not None:
            self._pq_writer.close()


def write_csv_variant(
    path: Path,
    headers: Sequence[str],
    records: Sequence[Dict[str, Any]],
    delimiter: str = ",",
    encoding: str = "utf-8",
    bom: bool = False,
) -> None:
    """Write a bounded CSV/TSV sample with explicit encoding, BOM, and delimiter settings."""
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=delimiter)
    writer.writerow(headers)
    for row in records:
        writer.writerow([row.get(h) for h in headers])
    raw_bytes = buf.getvalue().encode(encoding, errors="replace")
    if bom:
        raw_bytes = b"\xef\xbb\xbf" + raw_bytes
    path.write_bytes(raw_bytes)
