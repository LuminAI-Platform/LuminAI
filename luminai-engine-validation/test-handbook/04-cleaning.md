# Manual Test Handbook — 04: Data Cleaning & Standardization (`CLN-01` to `CLN-07`)

---

### Test 12: Interactive `CleaningEngine` Ops & Index-Aligned `preview_step` (`CLN-01`)

**1. What is this feature?**  
Executes `remove_missing`, `fill_missing`, `standardize_text`, `deduplicate`, and `handle_outliers` cleanly across `NaN`/whitespace/sentinels/fractional integer fences, and aligns row-level preview diffs even when earlier rows are deleted.

**2. How does it work internally?**  
`cleaning_operations.py` (`_missing_mask_expr`, `apply_remove_missing`, `apply_fill_missing`, `apply_handle_outliers`) + `cleaning_engine.py::CleaningEngine.preview_step` / `execute_recipe`.

**3. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.parquet` (`annual_income_usd`, `date_of_birth`, `full_name`)
- `datasets/<tier>/domain_e_geo_demographics.parquet` (`population`, `region`)

**4. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig

df = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_a_customers.parquet').head(300)
eng = CleaningEngine()
step_rem = CleaningStepConfig(step_id='s1', operation='remove_missing', parameters={'columns': ['annual_income_usd']})
prev_rem = eng.preview_step(df, step_rem)
print('remove_missing affected:', prev_rem.affected_rows, 'diffs:', len(prev_rem.sample_diffs), 'after rows:', prev_rem.total_rows_after)

step_fill = CleaningStepConfig(step_id='s2', operation='fill_missing', column='annual_income_usd', parameters={'strategy': 'mean'})
df_filled, audit_fill = eng.execute_recipe(df, [step_fill])
print('fill_missing audit:', audit_fill, 'remaining NaNs:', df_filled['annual_income_usd'].is_nan().sum())

df_int = pl.DataFrame({'x': [10, 11, 12, 13, 1000]})
step_cap = CleaningStepConfig(step_id='s3', operation='handle_outliers', column='x', parameters={'method': 'IQR', 'threshold': 1.25, 'action': 'cap'})
df_cap, audit_cap = eng.execute_recipe(df_int, [step_cap])
print('int fractional fence cap:', audit_cap, 'dtype:', df_cap['x'].dtype, 'val:', df_cap['x'][4])
"
```

**5. What output should I expect?**  
- `fill_missing` replaces BOTH `None` and `NaN` (`remaining NaNs == 0`) using true non-null mean!  
- `handle_outliers` casts integer `x` to `Float64` with exact upper fence `15.5` (`13 + 1.25 * 2`).  
- `remove_missing` `preview_step` identifies removed rows accurately by original row index rather than positional shifting!

---

### Test 13: Specialized Cleaners — `TextCleaner`, `DateCleaner`, `NameStandardizer`, `CategoricalStandardizer` (`CLN-02` to `CLN-05`)

**1. What is this feature?**  
Normalizes mojibake/HTML/formulas (`TextCleaner`), ambiguous/calendar/epoch/written dates (`DateCleaner`), smart casing (`McDonald`, `O'Connor`, `van der Beek` in `NameStandardizer`), and Ghanaian + international categories (`CategoricalStandardizer`).

**2. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv` (smart-case names rows `0..6`, mojibake rows `25..27`, formula row `28`, mixed dates)
- `datasets/<tier>/domain_e_geo_demographics.csv` (`country`, `"Kumasii"` typo)
- `datasets/<tier>/domain_f_survey.csv` (`gender`, `free_text_comment` with `x < y and y > z`)

**3. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.name_standardizer import NameStandardizer
from app.processing.engine.categorical_standardizer import CategoricalStandardizer

tc, dc, ns, cs = TextCleaner(), DateCleaner(), NameStandardizer(), CategoricalStandardizer()
print('Smart names:', [ns.standardize_name(x).cleaned for x in ['donald mcdonald', \"seamus o'connor\", 'jan van der beek', 'de Vries, Hendrik']])
print('Mojibake + Formula + Inequality:', tc.clean_text('RenÃ©e Mensah').cleaned, tc.clean_text('=CMD|calc').cleaned, tc.clean_text('x < y and y > z').cleaned)
print('Bad Feb30 vs Valid:', dc.clean_date('2024-02-30').is_valid, dc.clean_date('15 Jan 1990').cleaned)
print('Cats:', cs.standardize_country('gha').cleaned, cs.standardize_city('Kumasii').__dict__, cs.standardize_gender('1').__dict__)
"
```

**4. Expected Verification & Known Behavior to Inspect:**  
- Notice `NameStandardizer`: produces `Donald McDonald`, `Seamus O'Connor`, `Jan van der Beek`, `Hendrik de Vries` cleanly!  
- Check `tc.clean_text('x < y and y > z')`: note regex HTML stripping vs math inequality edge case (document any stripping of `< y and y >` as a `Low`/`Medium` observation!).  
- Check `cs.standardize_city('Kumasii')`: returns warning/fuzzy match suggestion `'Kumasi'`; check `standardize_gender('1')` rejects numeric code.

---

### Test 14: Master `DatasetCleaner` vs Dagster `cleaning_pipeline` Parity & Currency Parsing (`CLN-06`, `CLN-07`)

**1. What is this feature?**  
Tests full synchronous cleaning (`DatasetCleaner.clean_file`) and Dagster cleaning ops (`clean_records`, `deduplicate_dataset`, `_parse_currency_string`), including sorted-neighborhood windowing (`blocks >= 200`) and honest invalid currency returns (`None` instead of invented `0.0 USD`).

**2. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv`
- `datasets/<tier>/domain_b_ledger.csv` (`formatted_amount` containing `"invalid-amt"`, `"-€450.00"`, `""`)

**3. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.pipelines.cleaning_pipeline.helpers import _parse_currency_string
from app.processing.pipelines.cleaning_pipeline.cleaning_ops import clean_records

for s in ['\$1,250.50', '-€450.00', 'GBP 820.25', 'invalid-amt', '']:
    print(s, '->', _parse_currency_string(s))

df_b = pl.read_csv('../luminai-engine-validation/datasets/small/domain_b_ledger.csv').head(200)
cleaned = clean_records(df_b.select(['ledger_id', 'formatted_amount', 'fiscal_period']).rename({'ledger_id': 'id', 'fiscal_period': 'name'}))
print('cleaned currency sample:', cleaned.head(5))
"
```

**4. Expected Verification:**  
Verify `_parse_currency_string('invalid-amt')` and `''` return `(None, None)` — NOT `(0.0, 'USD')` — and `'-€450.00'` returns `(-450.0, 'EUR')`. Verify `clean_records` also preserves `McDonald` / `O'Connor` smart casing!
