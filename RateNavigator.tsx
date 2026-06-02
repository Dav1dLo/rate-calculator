import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

// Types
interface Job {
  id: number;
  rate: number;
  category:
    | "Data & AI"
    | "Software Engineering"
    | "Business & Functional Analysis"
    | "Project, Product & Agile Mgmt"
    | "IT Infra, Security & Support"
    | "Design & UX"
    | "Other/Management";
  seniority: "Junior" | "Medior" | "Senior/Expert" | "Unspecified";
  language: "English" | "Dutch" | "French";
  skills: string[];
}

const CATEGORIES: Job["category"][] = [
  "Data & AI",
  "Software Engineering",
  "Business & Functional Analysis",
  "Project, Product & Agile Mgmt",
  "IT Infra, Security & Support",
  "Design & UX",
  "Other/Management",
];

const SENIORITIES: Job["seniority"][] = [
  "Junior",
  "Medior",
  "Senior/Expert",
  "Unspecified",
];



// Seeded PRNG for reproducibility
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  // Box–Muller transform
  let u = 0,
    v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Data generation based on the provided research tables
function generateDataset(): Job[] {
  const rand = mulberry32(42);

  const categorySpecs: Record<
    Job["category"],
    { n: number; mean: number; sd: number; q1: number; median: number; q3: number; max: number }
  > = {
    "Data & AI": { n: 915, mean: 690, sd: 132, q1: 580, median: 700, q3: 770, max: 1300 },
    "Software Engineering": { n: 1716, mean: 609, sd: 118, q1: 550, median: 600, q3: 680, max: 1100 },
    "Business & Functional Analysis": { n: 1326, mean: 627, sd: 111, q1: 550, median: 650, q3: 700, max: 1050 },
    "Project, Product & Agile Mgmt": { n: 1857, mean: 660, sd: 125, q1: 590, median: 670, q3: 740, max: 1200 },
    "IT Infra, Security & Support": { n: 1308, mean: 617, sd: 146, q1: 500, median: 600, q3: 700, max: 1050 },
    "Design & UX": { n: 87, mean: 577, sd: 103, q1: 500, median: 600, q3: 650, max: 800 },
    "Other/Management": { n: 150, mean: 620, sd: 130, q1: 520, median: 600, q3: 700, max: 1100 },
  };

  // Seniority distributions and uplifts (approx based on Table 2)
  const seniorityMix: Partial<Record<Job["category"], { medior: number; senior: number }>> = {
    "Data & AI": { medior: 264, senior: 405 },
    "Software Engineering": { medior: 363, senior: 894 },
    "Business & Functional Analysis": { medior: 315, senior: 564 },
    "Project, Product & Agile Mgmt": { medior: 285, senior: 753 },
  };

  const seniorityUplift: Partial<Record<Job["category"], number>> = {
    "Data & AI": 0.236,
    "Software Engineering": 0.182,
    "Business & Functional Analysis": 0.182,
    "Project, Product & Agile Mgmt": 0.167,
  };

  const languageWeights: Record<Job["language"], number> = {
    English: 0.6,
    French: 0.2,
    Dutch: 0.2,
  };

  const skillsSpecs: Array<{ skill: string; parent?: Job["category"]; n: number; premium?: number }> = [
    { skill: "AI", parent: "Data & AI", n: 162, premium: 0.077 },
    { skill: "Machine Learning", parent: "Data & AI", n: 162, premium: 0.077 },
    { skill: "Databricks", parent: "Data & AI", n: 30, premium: 0.077 },
    { skill: "Power BI", parent: "Data & AI", n: 168, premium: -0.154 },
    { skill: "Azure", n: 375, premium: 0.083 },
    { skill: "AWS", n: 30, premium: 0.167 },
    { skill: "Cybersecurity", parent: "IT Infra, Security & Support", n: 213, premium: 0.133 },
    { skill: "SAP", n: 90, premium: 0.2 },
    { skill: "COBOL/Mainframe", parent: "Software Engineering", n: 24, premium: 0.083 },
    { skill: "React", parent: "Software Engineering", n: 360, premium: 0.06 },
    { skill: "Python", parent: "Data & AI", n: 420, premium: 0.05 },
    { skill: "Security", parent: "IT Infra, Security & Support", n: 270, premium: 0.1 },
  ];

  const jobs: Job[] = [];
  let idCounter = 1;

  // Helper to sample language by weight
  const langKeys = Object.keys(languageWeights) as Job["language"][];
  const langCum = langKeys.reduce<number[]>((acc, key, i) => {
    const w = languageWeights[key];
    const prev = acc[i - 1] ?? 0;
    acc.push(prev + w);
    return acc;
  }, []);

  const pickLanguage = () => {
    const r = rand();
    const idx = langCum.findIndex((c) => r <= c) ?? langCum.length - 1;
    return langKeys[Math.max(0, idx)];
  };

  // Generate base by category
  for (const cat of CATEGORIES) {
    const spec = categorySpecs[cat];
    const uplift = seniorityUplift[cat] ?? 0.18; // default

    // Determine seniority splits
    let mediorTarget = Math.round((seniorityMix[cat]?.medior ?? Math.round(spec.n * 0.28)));
    let seniorTarget = Math.round((seniorityMix[cat]?.senior ?? Math.round(spec.n * 0.48)));
    let remaining = spec.n - mediorTarget - seniorTarget;
    let juniorTarget = Math.max(0, Math.round(remaining * 0.25));
    let unspecifiedTarget = Math.max(0, remaining - juniorTarget);

    const buckets: Job["seniority"][] = [
      ...Array(mediorTarget).fill("Medior"),
      ...Array(seniorTarget).fill("Senior/Expert"),
      ...Array(juniorTarget).fill("Junior"),
      ...Array(unspecifiedTarget).fill("Unspecified"),
    ];

    for (let i = 0; i < spec.n; i++) {
      // base normal distribution around mean & sd
      const base = spec.mean + gaussian(rand) * spec.sd;
      let rate = clamp(Math.round(base), 300, spec.max);

      const s = buckets[i] ?? "Unspecified";
      if (s === "Senior/Expert") {
        rate = Math.round(rate * (1 + uplift));
      }

      if (s === "Junior") {
        rate = Math.round(rate * 0.85);
      }

      rate = clamp(Math.round(rate * 0.95), 285, 1281);

      jobs.push({
        id: idCounter++,
        category: cat,
        rate,
        seniority: s,
        language: pickLanguage(),
        skills: [],
      });
    }
  }

  // Assign skills to random jobs matching parent category where specified
  for (const spec of skillsSpecs) {
    let pool = jobs;
    if (spec.parent) pool = jobs.filter((j) => j.category === spec.parent);

    for (let i = 0; i < spec.n; i++) {
      const idx = Math.floor(rand() * pool.length);
      const job = pool[idx];
      if (!job) continue;
      if (!job.skills.includes(spec.skill)) job.skills.push(spec.skill);

      // Apply premium with gentle pull towards category median
      if (spec.premium && spec.premium !== 0) {
        const baseMedian = categorySpecs[job.category].median;
        const target = Math.round(baseMedian * (1 + spec.premium));
        job.rate = clamp(Math.round(job.rate * (1 + spec.premium * 0.6)), 300, 1348);
        // Slight nudge towards target to keep distribution believable
        job.rate = Math.round((job.rate * 3 + target) / 4);
      }
    }
  }

  return jobs;
}

// Stats helpers
function getStats(numbers: number[]) {
  const n = numbers.length;
  if (n === 0) {
    return { n: 0, mean: 0, median: 0, q1: 0, q3: 0, sd: 0, min: 0, max: 0 };
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const median = percentile(sorted, 50);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const variance = sorted.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n;
  const sd = Math.sqrt(variance);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { n, mean, median, q1, q3, sd, min, max };
}

function percentile(sorted: number[], p: number) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const h = idx - lo;
  return Math.round(sorted[lo] * (1 - h) + sorted[hi] * h);
}

function binHistogram(values: number[], start = 300, end = 1350, step = 50) {
  const bins: { name: string; range: [number, number]; count: number; percent: number }[] = [];
  for (let s = start; s <= end; s += step) {
    const e = s + step - 1;
    bins.push({ name: `€${s}–${e}`, range: [s, e], count: 0, percent: 0 });
  }
  for (const v of values) {
    const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((v - start) / step)));
    bins[idx].count += 1;
  }
  const total = values.length || 1;
  for (const b of bins) {
    b.percent = +(((b.count / total) * 100).toFixed(1));
  }
  return bins;
}

export default function RateNavigator() {
  const data = useMemo(() => generateDataset(), []);

  const [category, setCategory] = useState<string>("all");
  const [seniority, setSeniority] = useState<string>("all");
  const [tech, setTech] = useState<string>("all");

  const filtered = useMemo(() => {
    return data.filter((j) => {
      const byCategory = category === "all" || j.category === (category as Job["category"]);
      const bySeniority = seniority === "all" || j.seniority === (seniority as Job["seniority"]);
      const byTech = tech === "all" || j.skills.includes(tech);
      return byCategory && bySeniority && byTech;
    });
  }, [data, category, seniority, tech]);

  const stats = useMemo(() => getStats(filtered.map((j) => j.rate)), [filtered]);
  const histogram = useMemo(() => binHistogram(filtered.map((j) => j.rate)), [filtered]);
  const skills = useMemo(() => {
    const set = new Set<string>();
    data.forEach((j) => j.skills.forEach((s) => set.add(s)));
    const arr = Array.from(set);
    const priority = ["AI", "Machine Learning", "Databricks", "SAP", "Azure", "AWS"];
    arr.sort((a, b) => {
      const pa = priority.indexOf(a);
      const pb = priority.indexOf(b);
      const wa = pa === -1 ? 999 : pa;
      const wb = pb === -1 ? 999 : pb;
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });
    return arr;
  }, [data]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Signature interaction: pointer-reactive subtle glow in header card
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--pointer-x", `${x}px`);
      el.style.setProperty("--pointer-y", `${y}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const reset = () => {
    setCategory("all");
    setSeniority("all");
    setTech("all");
  };

  return (
    <section className="space-y-6">
      <Card ref={containerRef} className="bg-card/50 shadow-elegant">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Role Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Seniority</label>
              <Select value={seniority} onValueChange={setSeniority}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SENIORITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm text-muted-foreground">Technology/Skill</label>
                <Select value={tech} onValueChange={setTech}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {skills.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={reset} className="shrink-0">
                Reset filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 relative">
          <CardHeader>
            <CardTitle>Distribution of Daily Rates</CardTitle>
            
          </CardHeader>
          <CardContent className="relative">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals tickFormatter={(v: any) => `${v}%`} />
                  <RechartsTooltip
                    formatter={(value: any, _name, payload) => {
                      const p = payload?.payload as any;
                      return [`${value}%`, `${p.name}`];
                    }}
                    labelFormatter={() => "Range"}
                  />
                  <Bar dataKey="percent" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
            <CardDescription>Updated instantly as you filter</CardDescription>
            <p className="text-sm text-muted-foreground mt-2">
              Showing <span className="font-medium text-foreground">{stats.n}</span> roles
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Count (N)</dt>
                <dd className="text-foreground font-semibold">{stats.n}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mean</dt>
                <dd className="text-foreground font-semibold">€{Math.round(stats.mean)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Median</dt>
                <dd className="text-foreground font-semibold">€{stats.median}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Std. Dev.</dt>
                <dd className="text-foreground font-semibold">€{Math.round(stats.sd)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Q1 (25th)</dt>
                <dd className="text-foreground font-semibold">€{stats.q1}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Q3 (75th)</dt>
                <dd className="text-foreground font-semibold">€{stats.q3}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min</dt>
                <dd className="text-foreground font-semibold">€{stats.min}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Max</dt>
                <dd className="text-foreground font-semibold">€{stats.max}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

    </section>
  );
}
