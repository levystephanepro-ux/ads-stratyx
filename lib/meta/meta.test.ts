import test from "node:test";
import assert from "node:assert/strict";
import { countLeads, summarizeRows } from "./parse.ts";
import { buildMetaSection, META_UNAVAILABLE } from "./report.ts";

test("countLeads : prend le type le plus élevé, jamais la somme", () => {
  assert.equal(countLeads([
    { action_type: "lead", value: "12" },
    { action_type: "onsite_conversion.lead_grouped", value: "9" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
  ]), 12);
});

test("countLeads : un seul type présent, types étrangers ignorés, valeurs illisibles ignorées", () => {
  assert.equal(countLeads([{ action_type: "onsite_conversion.lead_grouped", value: "5" }]), 5);
  assert.equal(countLeads([{ action_type: "link_click", value: "400" }]), 0);
  assert.equal(countLeads([{ action_type: "lead", value: "abc" }]), 0);
  assert.equal(countLeads(undefined), 0);
});

test("summarizeRows : cpl = dépense / leads, null sans lead, ligne absente = zéros", () => {
  const a = summarizeRows("1", [{ spend: "100.00", impressions: "1000", clicks: "50", actions: [{ action_type: "lead", value: "4" }] }]);
  assert.equal(a.cpl, 25);
  assert.equal(a.leads, 4);
  const b = summarizeRows("2", [{ spend: "40.00", actions: [] }]);
  assert.equal(b.cpl, null);
  const c = summarizeRows("3", []);
  assert.deepEqual([c.spend, c.leads, c.cpl], [0, 0, null]);
});

const acc = (name: string, spend: number, leads: number) =>
  ({ accountId: name, accountName: name, spend, impressions: 0, clicks: 0, leads, cpl: leads > 0 ? spend / leads : null });

test("buildMetaSection : tableau, total et CPL global quand Google et Meta ont des leads", () => {
  const md = buildMetaSection({ accounts: [acc("A", 100, 4), acc("B", 50, 0)], failed: [] }, { cost: 300, conversions: 6 });
  assert.match(md, /^# Meta Ads/);
  assert.match(md, /\| \*\*Total Meta\*\* \|/);
  assert.match(md, /CPL global Google \+ Meta/);
  assert.match(md, /\| B \|[^|]*\| 0 \| - \|/);
});

test("buildMetaSection : pas de CPL global sans leads Google ou Meta", () => {
  assert.doesNotMatch(buildMetaSection({ accounts: [acc("A", 100, 4)], failed: [] }, null), /CPL global/);
  assert.doesNotMatch(buildMetaSection({ accounts: [acc("A", 100, 4)], failed: [] }, { cost: 300, conversions: 0 }), /CPL global/);
  assert.doesNotMatch(buildMetaSection({ accounts: [acc("A", 100, 0)], failed: [] }, { cost: 300, conversions: 6 }), /CPL global/);
});

test("buildMetaSection : Meta indisponible, et compte manquant signalé", () => {
  assert.match(buildMetaSection(null, null), new RegExp(META_UNAVAILABLE));
  assert.match(buildMetaSection({ accounts: [], failed: ["1"] }, null), new RegExp(META_UNAVAILABLE));
  assert.match(buildMetaSection({ accounts: [acc("A", 100, 4)], failed: ["999"] }, null), /Comptes non lus cette semaine : 999/);
});

test("buildMetaSection : un nom de compte ne casse pas le tableau", () => {
  const md = buildMetaSection({ accounts: [acc("Dupont | *Fenêtres*", 10, 1)], failed: [] }, null);
  assert.equal(md.split("\n").filter((l) => l.startsWith("| Dupont")).length, 1);
  assert.doesNotMatch(md, /Dupont \|/);
});
