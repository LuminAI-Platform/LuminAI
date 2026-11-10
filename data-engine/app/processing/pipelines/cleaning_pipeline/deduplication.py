"""Deduplication logic (exact email and fuzzy recordlinkage) for cleaning pipeline."""

import logging
import pandas as pd
import polars as pl
import recordlinkage
from dagster import AssetExecutionContext

logger = logging.getLogger(__name__)


def deduplicate_dataset(
    context: AssetExecutionContext,
    cleaned_df: pl.DataFrame,
) -> pl.DataFrame:
    """
    Deduplicate records using exact email matching and recordlinkage fuzzy name matching.
    """
    initial_rows = cleaned_df.height
    context.log.info(
        "🔍 deduplicated_ingestion_data: starting with %d rows", initial_rows
    )

    if initial_rows == 0:
        return cleaned_df

    # Step 1: Exact deduplication by email if present
    df_exact = cleaned_df
    email_col = (
        "email"
        if "email" in df_exact.columns
        else next(
            (
                c
                for c in ["contact_email", "user_email", "mail"]
                if c in df_exact.columns
            ),
            None,
        )
    )
    if email_col:
        df_exact = df_exact.unique(subset=[email_col], keep="first").sort("id")
    after_exact = df_exact.height
    context.log.info(
        "🔍 Step 1 (Exact): Deduplicated by %s — %d → %d rows",
        email_col or "id",
        initial_rows,
        after_exact,
    )

    if after_exact == 0:
        return df_exact

    # Step 2: Fuzzy deduplication by name (blocking on country if present)
    # Convert Polars to Pandas safely without pyarrow
    df_pd = pd.DataFrame(df_exact.to_dict(as_series=False))

    # Identify name column
    name_col = (
        "name"
        if "name" in df_pd.columns
        else next(
            (
                c
                for c in ["full_name", "customer_name", "first_name", "person_name"]
                if c in df_pd.columns
            ),
            None,
        )
    )
    if not name_col:
        context.log.info(
            "ℹ️ No 'name' column found in dataset, skipping fuzzy name deduplication"
        )
        return df_exact

    df_pd["_dedup_name"] = df_pd[name_col].fillna("")

    # Handle country for blocking if present
    has_country = "country" in df_pd.columns
    if has_country:
        df_pd["_dedup_country"] = df_pd["country"].fillna("")
    else:
        df_pd["_dedup_country"] = ""

    indexer = recordlinkage.Index()
    has_valid_country = has_country and (df_pd["_dedup_country"].str.len() > 0).any()

    if has_valid_country:
        indexer.block("_dedup_country")
    elif len(df_pd) > 1000:
        # Prevent O(N^2) Cartesian explosion on large datasets lacking country
        df_pd["_dedup_prefix"] = df_pd["_dedup_name"].str[:2].str.lower()
        if (df_pd["_dedup_prefix"].str.len() > 0).any():
            indexer.block("_dedup_prefix")
        else:
            indexer.sortedneighbourhood("_dedup_name", window=5)
    elif len(df_pd) > 300:
        indexer.sortedneighbourhood("_dedup_name", window=7)
    else:
        indexer.full()

    candidate_links = indexer.index(df_pd)

    # Compare
    compare = recordlinkage.Compare()
    compare.string(
        "_dedup_name",
        "_dedup_name",
        method="jarowinkler",
        threshold=0.85,
        label="name_score",
    )

    features = compare.compute(candidate_links, df_pd)

    # Filter matches
    matches = features[features["name_score"] >= 0.85]

    # Identify indices to drop
    to_drop = set()
    for idx1, idx2 in matches.index:
        drop_idx = max(idx1, idx2)
        name_1 = df_pd.loc[min(idx1, idx2), "_dedup_name"]
        name_2 = df_pd.loc[drop_idx, "_dedup_name"]
        context.log.info(
            "⚠️ Fuzzy match found: '%s' and '%s'. Merging...",
            name_1,
            name_2,
        )
        to_drop.add(drop_idx)

    # Clean temporary helper columns before converting back
    cols_to_clean = [
        c
        for c in ["_dedup_name", "_dedup_country", "_dedup_prefix"]
        if c in df_pd.columns
    ]
    df_pd = df_pd.drop(columns=cols_to_clean)

    # Drop matches
    df_dedup_pd = df_pd.drop(index=list(to_drop))

    # Convert back to Polars
    result = pl.from_pandas(df_dedup_pd)
    final_rows = result.height
    context.log.info(
        "✅ deduplicated_ingestion_data: complete — %d → %d rows (removed %d exact, %d fuzzy)",
        initial_rows,
        final_rows,
        initial_rows - after_exact,
        after_exact - final_rows,
    )
    return result
