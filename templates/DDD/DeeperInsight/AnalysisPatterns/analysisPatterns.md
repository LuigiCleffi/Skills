---
name: ddd-analysis-patterns
description: "How to use published analysis patterns (Fowler-style ACCOUNT and ENTRY, balanced TRANSACTION, POSTING RULE with eager, account-based and rule-based firing, and related catalog models such as Quantity, Range, Party and Accountability) as starting points for a domain model, adapting them under MODEL-DRIVEN DESIGN while keeping the pattern's core meaning and terms intact, based on Chapter 11 (Applying Analysis Patterns) of Domain-Driven Design. Use when modeling balances, ledgers, credits, points, wallets, stock levels, accruals, commissions, payouts or any value that must be auditable; a mutable balance field loses its history; a nightly batch or cron job hides business rules; derived postings (tax, fees, commission, reserves) are tangled across services; someone asks whether a known pattern exists for this domain; or the team borrowed a pattern name but changed what it means."
---

# Applying Analysis Patterns

An analysis pattern is a small, field-tested group of concepts for a recurring business problem, together with the reasoning and implementation consequences behind it. Treat it as a strong first draft of the model, not a finished answer: borrow the concepts and vocabulary, adapt the structure to your context and infrastructure, and keep the meaning of every borrowed term intact (or rename it when the meaning drifts).

## Where analysis patterns fit

- They sit above the building blocks (ENTITY, VALUE OBJECT, AGGREGATE) and supple design: a handful of objects that together represent one business concept (an account with its history, a rule that derives postings).
- Their value is less the class diagram than the recorded trade-offs: what was tried, what hurt in production, what the maintenance consequences were. A pattern without that reasoning is only a sketch.
- They are not frameworks. A framework is reusable code that works as a whole; an analysis pattern is a kit of model fragments you reshape. Do not import a "ledger library" and call that applying the pattern.
- Sources: Fowler's *Analysis Patterns* (accounting, inventory, measurement, party/organization, planning), industry data models, and the domain's own literature (accounting texts, clinical coding standards, logistics manuals). Domain experts recognize these concepts faster than invented ones.

Current note: Event Storming sessions are a common place where an analysis pattern surfaces; when sticky notes read "credit added", "credit used", "credit expired", an ACCOUNT/ENTRY model is likely nearby.

## ACCOUNT and ENTRY: keep the history, derive the balance

When it matters how a quantity changed (money, loyalty points, prepaid usage credits, stock on hand), do not store a mutable `balance` field alone. Record each change as an immutable ENTRY; the balance is the sum of entries. Caching the balance is an implementation choice hidden behind the ACCOUNT interface.

```ts
class Money {
  private constructor(readonly cents: bigint, readonly currency: string) {}
  static of(cents: bigint, currency: string) { return new Money(cents, currency); }
  plus(o: Money) { this.sameCurrency(o); return new Money(this.cents + o.cents, this.currency); }
  negate() { return new Money(-this.cents, this.currency); }
  isZero() { return this.cents === 0n; }
  equals(o: Money) { return this.cents === o.cents && this.currency === o.currency; }
  private sameCurrency(o: Money) { if (o.currency !== this.currency) throw new Error("currency mismatch"); }
}

class Entry {                                   // VALUE OBJECT: never edited, never deleted
  constructor(readonly amount: Money, readonly occurredOn: Date, readonly bookedOn: Date,
              readonly kind: "sale" | "commission" | "payout" | "adjustment") {}
}

class SellerAccount {                           // AGGREGATE ROOT
  private readonly entries: Entry[] = [];
  constructor(readonly id: AccountId, readonly currency: string) {}

  record(entry: Entry) {
    if (entry.amount.currency !== this.currency) throw new Error("wrong currency for account");
    this.entries.push(entry);                   // corrections are new negative entries
  }
  balance(): Money {
    return this.entries.reduce((sum, e) => sum.plus(e.amount), Money.of(0n, this.currency));
  }
  entriesSince(date: Date): readonly Entry[] { return this.entries.filter(e => e.bookedOn > date); }
}
```

- Two dates are often needed: when the event happened (`occurredOn`) and when it was recorded (`bookedOn`). Late-arriving data makes the difference visible.
- Corrections are reversing entries, never updates. This gives an audit trail for free.
- Long histories: keep the model, change the implementation (periodic snapshot entries, a cached balance updated in the same transaction, or a database view). The interface `balance()` does not change.

## TRANSACTION: conservation across accounts

If value moves between accounts and must never appear or vanish, model a TRANSACTION whose entries sum to zero (double entry). Use it only where the system is closed (all sources and sinks are modeled); many applications do not need the rigor.

```ts
class Transfer {
  private constructor(readonly legs: readonly [AccountId, Entry][]) {}
  static between(from: AccountId, to: AccountId, amount: Money, on: Date, kind: Entry["kind"]) {
    return Transfer.of([[from, new Entry(amount.negate(), on, on, kind)], [to, new Entry(amount, on, on, kind)]]);
  }
  static of(legs: [AccountId, Entry][]) {
    if (legs.length < 2) throw new Error("a transfer needs at least two legs");
    const total = legs.reduce((s, [, e]) => s.plus(e.amount), Money.of(0n, legs[0][1].amount.currency));
    if (!total.isZero()) throw new Error("unbalanced transfer");   // the invariant of the pattern
    return new Transfer(legs);
  }
}
```

How to tell it is misapplied: the "transaction" balances two entries inside the same account, or its legs are created days apart. The pattern means value moving between accounts, created at once. If your concept is different, use a different name.

Current note: entries live in different ACCOUNT aggregates. Common practice is one aggregate per database transaction and eventual consistency between aggregates, but a balanced transfer is a case where you either write all legs atomically (one database transaction over a ledger table) or model the transfer itself as the aggregate that owns its legs.

## POSTING RULE: make derived entries explicit

When an entry in one account should cause an entry in another (commission on each sale, a tax reserve on income, a referral bonus on a first purchase), logic tends to spread across services and batch jobs. Introduce a POSTING RULE: it watches an input account, computes a derived entry, and posts it to an output account.

```ts
interface PostingRule {
  readonly name: string;                        // "platform commission 12%"
  derive(entry: Entry): Entry | null;           // SIDE-EFFECT-FREE FUNCTION
  outputAccount(input: SellerAccount): AccountId;
}

class PercentageCommission implements PostingRule {
  constructor(readonly name: string, private readonly basisPoints: bigint, private readonly platform: AccountId) {}
  derive(e: Entry) {
    if (e.kind !== "sale") return null;
    const cents = (e.amount.cents * this.basisPoints) / 10_000n;
    return new Entry(Money.of(-cents, e.amount.currency), e.occurredOn, e.bookedOn, "commission");
  }
  outputAccount() { return this.platform; }
}
```

### Firing modes are part of the language

Deciding *when* rules run is the hard part. Name the choice explicitly in the UBIQUITOUS LANGUAGE and the design record:

| Mode | Who triggers | Fits when |
|---|---|---|
| Eager firing | Inserting the entry immediately runs its rules | Few rules, cheap computation, same transaction is acceptable |
| Account-based firing | Someone tells an account to process entries since its last firing | Rules depend on the account's state; batch per account |
| Rule-based firing | An external agent (scheduler, batch) tells the rule to run; the rule finds new input entries | Rules run on a schedule independent of how entries arrive |

Each set of rules needs exactly one point of initiation and one owner of "which entries are new" (for example a watermark per account). Mixed or implicit triggering produces double postings and missed postings.

```ts
class PostingRun {                                // application layer: thin orchestration
  constructor(private accounts: SellerAccountRepository, private rules: PostingRule[], private ledger: LedgerPort) {}
  async fire(asOf: Date) {
    for (const account of await this.accounts.withEntriesAfterWatermark()) {
      for (const entry of account.entriesSince(account.watermark)) {
        for (const rule of this.rules) {
          const derived = rule.derive(entry);
          if (derived) await this.ledger.post(rule.outputAccount(account), derived);
        }
      }
      account.advanceWatermark(asOf);
      await this.accounts.save(account);
    }
  }
}
```

A nightly job that "just moves numbers" is often an unrecognized domain model. When the script grows conditionals about which ledger, which fee type, which category, pull those decisions into rule objects in the domain layer and leave the script as a loop that sends a few intention-revealing messages and commits.

## Adapting a pattern without breaking it

- Expect to diverge in structure. Your ORM, table conventions or reporting needs may force subclasses or lookups the pattern does not have. Accept compromises that leave the model readable, note them in `DomainModel.md`, and keep moving.
- Do not diverge in meaning. If your "Transaction" no longer means balanced movement between accounts, rename it. Borrowed terms are valuable because others already understand them; a silently redefined term is worse than an invented one.
- Drop parts that add nothing. If every rule posts the full amount, you may not need a separate calculation-method object.
- Record known discomfort ("rule selection lives on the Seller for now; conceptually it belongs to the Account") so the next refactoring toward deeper insight has a target.

## Workflow

1. When modeling a new area, list its recurring concepts (balances, measurements, parties, roles, plans, schedules) and ask: has this been modeled before? Check analysis pattern catalogs and the domain's own literature.
2. Summarize the candidate pattern in a few lines in `DomainModel.md`: concepts, invariant, known trade-offs.
3. Walk real scenarios with a domain expert using the pattern's terms. Keep what they recognize and want ("we always wanted the commission history"); drop what they reject.
4. Fit it to the existing code: identify which current fields or scripts the pattern's objects replace.
5. Decide implementation choices the pattern leaves open (cached vs computed balance, firing mode, watermark ownership) and write them down with reasons.
6. Implement test-first: invariants (balanced transfer, no edits to entries) and side-effect-free derivations are easy to test.
7. Add borrowed terms to the glossary with their pattern meaning; rename anything whose meaning drifted.
8. Revisit after implementation: refinements found while coding update the model record.

## Red flags

- A single mutable `balance`, `points` or `stock` column with no history, plus a support team asking "how did it get to this number?".
- Business rules for derived amounts living only in a cron script, SQL procedure or ETL job.
- A pattern name used with a different meaning ("transaction" for any database write, "account" for a login).
- Copying a catalog diagram wholesale, including parts no scenario needs.
- Importing a generic ledger framework and assuming the domain is now modeled.
- No single answer to "who triggers the posting rules and how do we know which entries are new?".
- Deleting or editing entries to fix mistakes.

## Related

- `../../../actions/ddd.md` — workflow that records patterns adopted in `DomainModel.md` and the glossary.
- `../../../actions/dev.md` — implementing the adapted model.
- `../../../actions/tdd.md` — testing invariants and derivations first.
- `../ImplicitConcepts/implicitConcepts.md` — analysis patterns as a source of missing concepts.
- `../SuppleDesign/suppleDesign.md` — side-effect-free functions and assertions used by posting rules.
- `../DesignPatternsInTheModel/designPatternsInTheModel.md` — technical patterns that also carry domain meaning.
- `../BringingThePiecesTogether/bringingThePiecesTogether.md` — prior art within refactoring toward deeper insight.
- `../../ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` — keeping borrowed terms precise.
- `../../BuildingBlocks/ModelInSoftware/modelInSoftware.md` — ENTITY and VALUE OBJECT choices for accounts and entries.
- `../../BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` — aggregate boundaries for accounts and transfers.
- `../../../DataSystems/DistributedData/Transactions/transactions.md` — atomic multi-account writes (when installed).
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — storing append-only histories (when installed).
