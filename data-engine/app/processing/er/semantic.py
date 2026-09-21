"""Semantic & Vector Embedding Matcher for Entity Resolution.

Provides:
  - Canonical nickname mapping (e.g. Bob -> Robert, Bill -> William, Meg -> Margaret).
  - Acronym / initialism resolver (e.g. IBM <-> International Business Machines).
  - Semantic character n-gram cosine similarity for permutations and word order variants.
"""

from __future__ import annotations

import collections
import math
import re
from typing import Mapping

# Common nickname -> canonical name mapping (lowercase)
NICKNAME_MAP: Mapping[str, str] = {
    # R
    "bob": "robert",
    "bobby": "robert",
    "rob": "robert",
    "robbie": "robert",
    "bert": "robert",
    "dick": "richard",
    "rick": "richard",
    "ricky": "richard",
    "rich": "richard",
    "richie": "richard",
    "ron": "ronald",
    "ronnie": "ronald",
    "ray": "raymond",
    "russ": "russell",
    # W
    "bill": "william",
    "billy": "william",
    "will": "william",
    "willy": "william",
    "liam": "william",
    # J
    "jim": "james",
    "jimmy": "james",
    "jack": "john",
    "johnny": "john",
    "joe": "joseph",
    "joey": "joseph",
    "jake": "jacob",
    "jerry": "gerald",
    "jeff": "jeffrey",
    # M
    "mike": "michael",
    "mikey": "michael",
    "mick": "michael",
    "matt": "matthew",
    "matty": "matthew",
    "mitch": "mitchell",
    # A
    "alex": "alexander",
    "alec": "alexander",
    "sasha": "alexander",
    "andy": "andrew",
    "drew": "andrew",
    "tony": "anthony",
    "art": "arthur",
    "artie": "arthur",
    "al": "albert",
    # D
    "dan": "daniel",
    "danny": "daniel",
    "dave": "david",
    "davy": "david",
    "don": "donald",
    "donny": "donald",
    "doug": "douglas",
    # C
    "chris": "christopher",
    "topher": "christopher",
    "charlie": "charles",
    "chuck": "charles",
    "cliff": "clifford",
    "curt": "curtis",
    # E
    "ed": "edward",
    "eddie": "edward",
    "ted": "edward",
    "teddy": "edward",
    "ned": "edward",
    # T
    "tom": "thomas",
    "tommy": "thomas",
    "tim": "timothy",
    "timmy": "timothy",
    # S
    "steve": "stephen",
    "stevie": "stephen",
    "sam": "samuel",
    "sammy": "samuel",
    # Female Names
    "liz": "elizabeth",
    "lizzie": "elizabeth",
    "beth": "elizabeth",
    "betty": "elizabeth",
    "eliza": "elizabeth",
    "kate": "katherine",
    "katie": "katherine",
    "cathy": "katherine",
    "kat": "katherine",
    "meg": "margaret",
    "maggie": "margaret",
    "peggy": "margaret",
    "jen": "jennifer",
    "jenny": "jennifer",
    "sue": "susan",
    "suzie": "susan",
    "pat": "patricia",
    "patty": "patricia",
    "tricia": "patricia",
    "debbie": "deborah",
    "deb": "deborah",
    "becky": "rebecca",
    "becca": "rebecca",
    "vicky": "victoria",
    "vic": "victoria",
}

# Common enterprise acronym dictionary
ACRONYM_MAP: Mapping[str, str] = {
    "ibm": "international business machines",
    "ge": "general electric",
    "mit": "massachusetts institute of technology",
    "who": "world health organization",
    "fbi": "federal bureau of investigation",
    "cia": "central intelligence agency",
    "nasa": "national aeronautics and space administration",
    "pwc": "pricewaterhousecoopers",
    "ey": "ernst and young",
    "kpmg": "klynveld peat marwick goerdeler",
    "hpe": "hewlett packard enterprise",
    "hp": "hewlett packard",
    "sap": "systemanalyse programmentwicklung",
    "aws": "amazon web services",
    "gcp": "google cloud platform",
}


def canonicalize_name(name: str | None) -> str:
    """Canonicalize full or single names by replacing known nicknames with formal names."""
    if not name or not isinstance(name, str):
        return ""
    
    clean = re.sub(r"[^a-zA-Z\s]", "", name).strip().lower()
    if not clean:
        return ""

    tokens = clean.split()
    if not tokens:
        return ""

    # Replace first token if it's a known nickname
    first = tokens[0]
    canonical_first = NICKNAME_MAP.get(first, first)
    tokens[0] = canonical_first

    return " ".join(tokens)


CORPORATE_SUFFIXES = {"corp", "corporation", "inc", "incorporated", "llc", "ltd", "limited", "co", "company"}


def is_acronym_match(str_a: str, str_b: str) -> bool:
    """Check if one string is an acronym/abbreviation of the other."""
    a = re.sub(r"[^a-zA-Z\s]", "", str_a).strip().lower()
    b = re.sub(r"[^a-zA-Z\s]", "", str_b).strip().lower()

    if not a or not b or a == b:
        return False

    def _match_raw(x: str, y: str) -> bool:
        if ACRONYM_MAP.get(x) == y or ACRONYM_MAP.get(y) == x:
            return True
        short_str, long_str = (x, y) if len(x) < len(y) else (y, x)
        short_tokens = short_str.split()
        long_tokens = long_str.split()
        if len(short_tokens) == 1 and len(long_tokens) >= 2:
            acronym_letters = short_tokens[0]
            stop_words = {"of", "and", "the", "for", "in", "at", "de"}
            filtered_long = [tok for tok in long_tokens if tok not in stop_words]
            initials_all = "".join(tok[0] for tok in long_tokens if tok)
            initials_filtered = "".join(tok[0] for tok in filtered_long if tok)
            if acronym_letters == initials_all or acronym_letters == initials_filtered:
                return True
        return False

    if _match_raw(a, b):
        return True

    # Strip corporate suffixes and test again (e.g. "IBM Corp" vs "International Business Machines Corp")
    a_tokens = [t for t in a.split() if t not in CORPORATE_SUFFIXES]
    b_tokens = [t for t in b.split() if t not in CORPORATE_SUFFIXES]
    if a_tokens and b_tokens:
        clean_a_corp = " ".join(a_tokens)
        clean_b_corp = " ".join(b_tokens)
        if clean_a_corp != a or clean_b_corp != b:
            if _match_raw(clean_a_corp, clean_b_corp):
                return True

    return False


def _char_ngrams(text: str, n: int = 3) -> collections.Counter[str]:
    """Generate character n-grams from normalized text."""
    clean = f" {re.sub(r'[^a-zA-Z0-9]', ' ', text).strip().lower()} "
    if len(clean) < n:
        return collections.Counter([clean])
    return collections.Counter(clean[i : i + n] for i in range(len(clean) - n + 1))


def ngram_cosine_similarity(str_a: str | None, str_b: str | None, n: int = 3) -> float:
    """Compute cosine similarity over character n-gram vectors.
    
    Robust to token permutations ('Smith, Alice' vs 'Alice Smith') and minor typos.
    """
    if str_a is None or str_b is None:
        return 0.0
    s_a, s_b = str(str_a).strip().lower(), str(str_b).strip().lower()
    if not s_a and not s_b:
        return 1.0
    if not s_a or not s_b:
        return 0.0
    if s_a == s_b:
        return 1.0

    vec_a = _char_ngrams(s_a, n=n)
    vec_b = _char_ngrams(s_b, n=n)

    intersection = set(vec_a.keys()) & set(vec_b.keys())
    dot_product = sum(vec_a[x] * vec_b[x] for x in intersection)

    sum_a = sum(val**2 for val in vec_a.values())
    sum_b = sum(val**2 for val in vec_b.values())

    if sum_a == 0 or sum_b == 0:
        return 0.0

    return max(0.0, min(1.0, float(dot_product / (math.sqrt(sum_a) * math.sqrt(sum_b)))))


def semantic_name_similarity(name_a: str | None, name_b: str | None) -> float:
    """Calculate semantic similarity between two names or entity titles.

    Combines:
      1. Exact match (1.0)
      2. Nickname expansion equivalence (e.g. 'Bob Jones' vs 'Robert Jones' -> 0.95+)
      3. Acronym / abbreviation match (e.g. 'IBM' vs 'International Business Machines' -> 0.95)
      4. Token set equality / permutations (e.g. 'Smith, Alice' vs 'Alice Smith' -> 0.98)
      5. Character n-gram vector cosine similarity for typo and sub-string tolerance.
    """
    if name_a is None or name_b is None:
        return 0.0

    s_a = str(name_a).strip()
    s_b = str(name_b).strip()

    if not s_a and not s_b:
        return 1.0
    if not s_a or not s_b:
        return 0.0

    clean_a = re.sub(r"[^a-zA-Z0-9\s]", "", s_a).strip().lower()
    clean_b = re.sub(r"[^a-zA-Z0-9\s]", "", s_b).strip().lower()

    if clean_a == clean_b:
        return 1.0

    # 1. Acronym / abbreviation check
    if is_acronym_match(clean_a, clean_b):
        return 0.95

    # 2. Token set match (permutations like "Smith, Alice" vs "Alice Smith")
    tokens_a = set(clean_a.split())
    tokens_b = set(clean_b.split())
    if tokens_a and tokens_a == tokens_b:
        return 0.98

    # 3. Canonical nickname expansion
    canon_a = canonicalize_name(clean_a)
    canon_b = canonicalize_name(clean_b)
    if canon_a and canon_b:
        if canon_a == canon_b:
            return 0.96
        # Compare token sets with canonical nicknames
        c_tokens_a = set(canon_a.split())
        c_tokens_b = set(canon_b.split())
        if c_tokens_a == c_tokens_b:
            return 0.96

    # 4. Character n-gram vector cosine similarity
    cosine_sim = ngram_cosine_similarity(clean_a, clean_b, n=3)
    return round(float(cosine_sim), 4)
