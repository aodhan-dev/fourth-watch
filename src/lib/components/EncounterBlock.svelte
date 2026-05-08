<script lang="ts">
  import type { Encounter, Monster, AbilityScores } from '$lib/engine/types';

  let { encounter, message }: { encounter: Encounter | null; message: string | null } = $props();
  let expanded = $state(false);

  function abilityMod(score: number): string {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  }

  function crLabel(cr: number): string {
    if (cr === 0) return '0';
    if (cr < 1) return `1/${Math.round(1 / cr)}`;
    return `${cr}`;
  }

  function nonEmpty<T>(arr: T[] | undefined): arr is T[] {
    return Array.isArray(arr) && arr.length > 0;
  }

  function hasStr(v: string | undefined): v is string {
    return !!v && v.length > 0;
  }

  // Order ability columns in the canonical D&D order regardless of source ordering.
  const abilityKeys: Array<{ key: keyof AbilityScores; label: string }> = [
    { key: 'str', label: 'STR' },
    { key: 'dex', label: 'DEX' },
    { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' },
    { key: 'wis', label: 'WIS' },
    { key: 'cha', label: 'CHA' }
  ];

  function formatNumberMap(m: Record<string, number> | undefined): string | null {
    if (!m) return null;
    const entries = Object.entries(m).filter(([, v]) => typeof v === 'number');
    if (entries.length === 0) return null;
    return entries
      .map(([k, v]) => {
        const sign = v >= 0 ? '+' : '';
        const cap = k.charAt(0).toUpperCase() + k.slice(1);
        return `${cap} ${sign}${v}`;
      })
      .join(', ');
  }

  function statBlockMeta(c: Monster): string {
    const parts: string[] = [];
    if (c.size) parts.push(c.size);
    if (c.type) parts.push(c.type.toLowerCase());
    const head = parts.join(' ');
    return c.alignment ? `${head}, ${c.alignment}` : head;
  }

  let saves = $derived(encounter ? formatNumberMap(encounter.creature.savingThrows) : null);
  let skills = $derived(encounter ? formatNumberMap(encounter.creature.skills) : null);
</script>

<section class="encounter">
  <h2>Encounter</h2>
  {#if encounter === null}
    <p class="quiet">{message ?? 'The road is quiet.'}</p>
  {:else}
    {@const c = encounter.creature}
    <p class="lead">
      <span class="attitude" data-attitude={encounter.attitude.toLowerCase()}>
        {encounter.attitude}
      </span>
      {encounter.narrative}
    </p>
    <button
      class="expand"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      aria-controls="stat-block"
    >
      {expanded ? 'Hide' : 'Show'} stat block
      <span class="chevron" aria-hidden="true">▼</span>
    </button>
    {#if expanded}
      <article class="stat-block" id="stat-block" aria-label="{c.name} stat block">
        <header class="sb-header">
          <h3 class="sb-name">{c.name}</h3>
          {#if statBlockMeta(c)}
            <p class="sb-meta">{statBlockMeta(c)}</p>
          {/if}
        </header>

        <dl class="sb-line">
          <div>
            <dt>AC</dt>
            <dd>{c.ac}{c.acDetail ? ` (${c.acDetail})` : ''}</dd>
          </div>
          <div>
            <dt>HP</dt>
            <dd>{c.hp}{c.hitDice ? ` (${c.hitDice})` : ''}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{c.speed || '—'}</dd>
          </div>
        </dl>

        {#if c.abilityScores}
          <table class="abilities">
            <thead>
              <tr>
                {#each abilityKeys as a (a.key)}<th scope="col">{a.label}</th>{/each}
              </tr>
            </thead>
            <tbody>
              <tr>
                {#each abilityKeys as a (a.key)}<td class="ab-score">{c.abilityScores[a.key]}</td
                  >{/each}
              </tr>
              <tr>
                {#each abilityKeys as a (a.key)}<td class="ab-mod"
                    >{abilityMod(c.abilityScores[a.key])}</td
                  >{/each}
              </tr>
            </tbody>
          </table>
        {/if}

        <dl class="sb-meta-list">
          {#if saves}
            <div>
              <dt>Saves</dt>
              <dd>{saves}</dd>
            </div>
          {/if}
          {#if skills}
            <div>
              <dt>Skills</dt>
              <dd>{skills}</dd>
            </div>
          {/if}
          {#if hasStr(c.damageVulnerabilities)}
            <div>
              <dt>Vulnerabilities</dt>
              <dd>{c.damageVulnerabilities}</dd>
            </div>
          {/if}
          {#if hasStr(c.damageResistances)}
            <div>
              <dt>Resistances</dt>
              <dd>{c.damageResistances}</dd>
            </div>
          {/if}
          {#if hasStr(c.damageImmunities)}
            <div>
              <dt>Damage Immunities</dt>
              <dd>{c.damageImmunities}</dd>
            </div>
          {/if}
          {#if hasStr(c.conditionImmunities)}
            <div>
              <dt>Condition Immunities</dt>
              <dd>{c.conditionImmunities}</dd>
            </div>
          {/if}
          {#if hasStr(c.senses)}
            <div>
              <dt>Senses</dt>
              <dd>{c.senses}</dd>
            </div>
          {/if}
          {#if hasStr(c.languages)}
            <div>
              <dt>Languages</dt>
              <dd>{c.languages}</dd>
            </div>
          {/if}
          <div>
            <dt>CR</dt>
            <dd>{crLabel(c.cr)}{c.xp ? ` (${c.xp.toLocaleString()} XP)` : ''}</dd>
          </div>
        </dl>

        {#if nonEmpty(c.traits)}
          <section class="block">
            {#each c.traits as t (t.name)}
              <p class="entry"><strong>{t.name}.</strong> {t.desc}</p>
            {/each}
          </section>
        {/if}

        {#if nonEmpty(c.actions)}
          <section class="block">
            <h4 class="block-title">Actions</h4>
            {#each c.actions as a (a.name)}
              <p class="entry"><strong>{a.name}.</strong> {a.desc}</p>
            {/each}
          </section>
        {/if}

        {#if nonEmpty(c.bonusActions)}
          <section class="block">
            <h4 class="block-title">Bonus Actions</h4>
            {#each c.bonusActions as a (a.name)}
              <p class="entry"><strong>{a.name}.</strong> {a.desc}</p>
            {/each}
          </section>
        {/if}

        {#if nonEmpty(c.reactions)}
          <section class="block">
            <h4 class="block-title">Reactions</h4>
            {#each c.reactions as a (a.name)}
              <p class="entry"><strong>{a.name}.</strong> {a.desc}</p>
            {/each}
          </section>
        {/if}

        {#if nonEmpty(c.legendaryActions)}
          <section class="block">
            <h4 class="block-title">Legendary Actions</h4>
            {#if hasStr(c.legendaryDesc)}
              <p class="entry">{c.legendaryDesc}</p>
            {/if}
            {#each c.legendaryActions as a (a.name)}
              <p class="entry"><strong>{a.name}.</strong> {a.desc}</p>
            {/each}
          </section>
        {/if}
      </article>
    {/if}
  {/if}
</section>

<style>
  .encounter {
    margin-bottom: 0;
  }
  h2 {
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    color: var(--accent);
    margin: 0 0 0.5rem;
  }
  .lead {
    font-size: 1.2rem;
    line-height: 1.45;
    color: var(--text);
    margin: 0;
  }
  .attitude {
    display: inline-block;
    margin-right: 0.5rem;
    padding: 0.15rem 0.6rem;
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    border-radius: 999px;
    border: 1px solid currentColor;
    vertical-align: 0.18em;
  }
  .attitude[data-attitude='hostile'] {
    color: #f3b6c0;
    background: rgba(196, 75, 107, 0.18);
  }
  .attitude[data-attitude='indifferent'] {
    color: var(--text-dim);
    background: rgba(255, 255, 255, 0.04);
  }
  .attitude[data-attitude='friendly'] {
    color: #b6e5b9;
    background: rgba(74, 143, 78, 0.18);
  }
  .expand {
    margin-top: 0.85rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }
  .expand:hover {
    color: var(--text);
    border-color: var(--accent-soft);
  }
  .chevron {
    display: inline-block;
    font-size: 0.7rem;
    margin-left: 0.35rem;
    transition: transform 200ms ease;
    vertical-align: middle;
  }
  .expand[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }
  .quiet {
    font-style: italic;
    color: var(--text-muted);
    margin: 0;
    font-size: 1.05rem;
  }

  .stat-block {
    margin: 0.85rem 0 0;
    padding: 1.1rem 1.2rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    color: var(--text-dim);
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .sb-header {
    margin-bottom: 0.7rem;
    padding-bottom: 0.55rem;
    border-bottom: 1px solid var(--accent-soft);
  }
  .sb-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
  }
  .sb-meta {
    margin: 0.15rem 0 0;
    font-style: italic;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .sb-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0 0 0.85rem;
  }
  .sb-line div {
    display: inline-flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  .sb-line dt {
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--accent);
  }
  .sb-line dd {
    margin: 0;
    color: var(--text);
  }

  .abilities {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 0.95rem;
  }
  .abilities th {
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--accent);
    text-align: center;
    padding-top: 0.55rem;
    border-top: 1px solid var(--border);
  }
  .abilities td {
    text-align: center;
  }
  .abilities td.ab-score {
    font-size: 1.05rem;
    color: var(--text);
    font-weight: 600;
    line-height: 1.1;
  }
  .abilities td.ab-mod {
    font-size: 0.78rem;
    color: var(--text-dim);
    padding-bottom: 0.55rem;
    border-bottom: 1px solid var(--border);
  }

  .sb-meta-list {
    margin: 0 0 0.85rem;
    display: grid;
    gap: 0.3rem;
  }
  .sb-meta-list div {
    display: grid;
    grid-template-columns: 9rem 1fr;
    gap: 0.5rem;
    align-items: baseline;
  }
  .sb-meta-list dt {
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--accent);
  }
  .sb-meta-list dd {
    margin: 0;
    color: var(--text-dim);
  }

  .block {
    margin: 0.85rem 0 0;
    padding-top: 0.55rem;
    border-top: 1px solid var(--border);
  }
  .block-title {
    margin: 0 0 0.45rem;
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .entry {
    margin: 0 0 0.55rem;
    color: var(--text-dim);
    font-size: 0.9rem;
  }
  .entry strong {
    color: var(--text);
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .abilities th,
    .abilities td {
      font-size: 0.75rem;
    }
    .sb-meta-list div {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .sb-meta-list dt {
      margin-bottom: 0.05rem;
    }
  }
</style>
