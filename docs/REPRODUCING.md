# Reproducing the review numbers

Tuval claims one thing about reviewing agent work, and this is how to check it against your own
workspace rather than taking it from a README.

```bash
node scripts/review-cost.mjs 40
```

It needs `TUVAL_API_KEY` and `VITE_SUPABASE_URL` in `.env.local`, and the Supabase CLI linked to
the same project — the writing half goes through the public API, and the measuring half reads
tables the API deliberately does not expose.

## What it does

1. Writes forty records through the HTTP API with a run header, exactly as an agent does. Real
   key, real gateway, real triggers.
2. Changes each one once, so every record has a revision with a previous value in it.
3. Measures the two ways of reviewing that run, both inside one database session so the numbers
   are the queries rather than Node starting up.
4. Deletes everything it wrote.

## What it printed here, on 2026-08-03

```
  one record at a time     40 queries       1.7 ms     80 rows
  the run, once             2 queries       2.9 ms     80 rows

  40 queries and 40 screens become 2 and one. Putting it back is 40 actions or one.
```

## What that is, and what it is not

**It is a claim about attention, not about speed.** Reading the run is *slower* in milliseconds —
2.9 against 1.7 — because `agent_runs` groups and counts where the per-record path just fetches.
That number is printed because it is true, and a benchmark that only prints the column its author
wins is an advertisement.

The thing that changes is how many places a person has to look. Forty changes with no run behind
them are forty histories, each opened on its own, each holding its own before-and-after; the
connection between them lives in the reviewer's head. With a run they are one list with every
previous value beside it, and putting the night back is one action.

**The writes underneath an undo are still one per record.** The database does forty updates
either way. What went from forty to one is the number of decisions somebody makes.

**Nothing here is measured about tokens or model cost.** Tuval holds the work, not the codebase;
what an agent spends reading a repository is a different tool's problem and not one we have
measured.

## Related

- [Agents](agents.md) — what an agent can and cannot do with a key
- [HTTP API](api.md) — the door the script writes through
