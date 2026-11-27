# Manual Test Handbook — 05: Data Transformation (`TRN-01`)

---

### Test 15: `PipelineBuilderEngine` Multi-Step DAG Transforms (`TRN-01`)

**1. What is this feature?**  
Executes sequential DAG pipeline transformations (`FILTER`, `SELECT`, `DROP`, `RENAME`, `DERIVE`, `JOIN`, `GROUP_BY`, `SORT`, `DEDUPLICATE`) via `PipelineBuilderEngine` and `POST /analytics/pipelines/execute`.

**2. Why does LuminAI need it?**  
Interactive Pipeline Builder recipes transform raw staging tables into normalized analytics models without custom SQL code.

**3. How does it work internally?**  
`app/processing/engine/pipeline_builder.py::PipelineBuilderEngine.execute_pipeline` applies Polars DataFrame expressions step-by-step, supporting negative/scientific literals in `DERIVE` and mapping `outer`/`full_outer` joins to Polars `how="full"`.

**4. What dataset should I use?**  
- Clean or messy orders & products:
  - `reference-data/clean-data/<tier>/domain_c_orders_clean.csv`
  - `datasets/<tier>/domain_c_orders_denormalized.parquet` (`orphaned_product_fk_orders`!)
  - `datasets/<tier>/domain_c_products.parquet`

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.engine.pipeline_builder import PipelineBuilderEngine, TransformationStep

orders = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_c_orders_denormalized.parquet')
prods = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_c_products.parquet')

steps = [
    TransformationStep(step_id='1', step_type='FILTER', parameters={'column': 'quantity', 'operator': '>', 'value': 0}),
    TransformationStep(step_id='2', step_type='DERIVE', parameters={'column_name': 'scaled_total', 'expression': 'order_total * 1e-2'}),
    TransformationStep(step_id='3', step_type='DERIVE', parameters={'column_name': 'qty_offset', 'expression': 'quantity + -1'}),
    TransformationStep(step_id='4', step_type='GROUP_BY', parameters={'group_by': ['product_category'], 'aggregate_column': 'order_total', 'function': 'sum'}),
    TransformationStep(step_id='5', step_type='SORT', parameters={'by': ['order_total_sum'], 'descending': True}),
]
res, rep = PipelineBuilderEngine.execute_pipeline(orders, steps)
print('Pipeline status:', rep.status, 'step_metrics:', rep.step_metrics)
print('Grouped Clean Category Sums:\n', res)

# Separate OUTER join integrity test using orphan product FKs:
join_step = [TransformationStep(step_id='j1', step_type='JOIN', parameters={'right_dataset': 'prods', 'on': 'product_id', 'how': 'outer'})]
joined, join_rep = PipelineBuilderEngine.execute_pipeline(
    orders.head(500).select(['order_id', 'product_id', 'order_total']),
    join_step,
    secondary_datasets={'prods': prods.select(['product_id', 'inventory_qty'])},
)
print('Outer join rows:', joined.height, 'unmatched right inventory nulls:', joined['inventory_qty'].null_count())
"
```

**6. What should happen internally?**  
`FILTER` excludes negative-quantity rows cleanly; `DERIVE` evaluates `1e-2` and `-1` arithmetic expressions via Polars; `GROUP_BY` aggregates sum by `product_category`; `JOIN(how="outer")` maps cleanly to Polars `how="full"` without deprecation/InvalidOperation error, preserving unmatched orphan orders as nulls!

**7. What output should I expect?**  
Check unmatched orphan count and compare category sums on `clean-data/<tier>/domain_c_orders_clean.csv` against `reference-data/expected-results/<tier>/expected_domain_c.json["clean_category_sum_order_total"]`!

**8. How do I verify correctness?**  
Run the same `GROUP_BY` on `reference-data/clean-data/small/domain_c_orders_clean.csv` and assert exact match (within `$0.01`) to `expected_domain_c.json["clean_category_sum_order_total"]` and `clean_category_order_counts`.

**9. What can go wrong?**  
- Unhandled negative literal regex failure in `DERIVE` if expression parser regresses.  
- Unrecognized `FILTER` operator or missing column silently returning unfiltered `df` without raising an explicit error (known quirk — verify by passing an invalid operator!).

**10. What does a successful result look like?**  
Exact category sums matching independent ground truth, `outer` join completes cleanly with expected null matches, and scientific/negative `DERIVE` literals evaluate accurately.

**11. What should I record?**  
Record exact category sums, join row count, and edge test result on unknown operator in `test-results/execution-log.md`.
