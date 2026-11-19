# Benchmark: every tool pre-loaded vs. just-in-time grafting

Run 2026-11-19 23:27 · 6 questions × 2 setups · models: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b (free tiers; models rotate on rate limits)

| metric | all tools pre-loaded | Synaptogenesis (JIT) |
|---|---|---|
| answer accuracy (facts found) | 100% | 97% |
| input tokens / question | 9,868 | 10,201 |
| tool-schema size / request (chars) | 11,879 | 2,125 |
| tools visible to the model | 38.0 | 4.0 |
| tool calls / question | 2.7 | 4.8 |
| failed tool calls / question | 0.00 | 0.00 |
| model turns / question | 3.7 | 6.2 |
| seconds / question (incl. free-tier waits) | 21.5 | 24.4 |

| task | static score | jit score |
|---|---|---|
| delay-impact | 100% | 83% |
| low-stock | 100% | 100% |
| account-manager | 100% | 100% |
| expiring | 100% | 100% |
| customer-tickets | 100% | 100% |
| south-oncall | 100% | 100% |

Accuracy = share of known-true facts (ids, names) present in the answer. Raw answers: `.synapto/bench/results-20261119-232759.json`.
