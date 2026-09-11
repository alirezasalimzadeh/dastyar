import { useEffect, useState, useCallback, useMemo, type ComponentType, type ReactNode } from 'react';
import {
  Target, ArrowLeft, Zap, Search, TrendingUp, Check, ChevronDown, ChevronUp,
  Building2, Users, Flame, AlertTriangle, Info, Minus, X, Ruler, BedDouble,
  Home, Wallet, ShieldCheck, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { scoreMatch, rankMatches, persistMatches, type ScoredMatchOutput, type ScoredComponent } from '@/lib/matchingEngine';
import { formatPrice, formatMoneyShort, getTransactionLabel, getCategoryLabel, getPropertyTypeLabel, getTemperatureInfo, PROPERTY_TYPES } from '@/lib/constants';
import { EmptyState, Spinner, PageHeader } from '@/components/ui';
import type { Property, Customer } from '@/lib/types';

type MatchEntry =
  | { type: 'customer'; data: Customer; result: ScoredMatchOutput }
  | { type: 'property'; data: Property; result: ScoredMatchOutput };

// ---- ثابت‌های نمایش (آستانه‌ها دقیقاً مطابق config موتور / §۱۳ سند) ----
const SCORE_TIERS = [
  { min: 85, label: 'عالی', color: '#16a34a', bg: '#dcfce7', border: '#16a34a' },
  { min: 70, label: 'خوب', color: '#65a30d', bg: '#ecfccb', border: '#65a30d' },
  { min: 55, label: 'متوسط', color: '#f97316', bg: '#ffedd5', border: '#f97316' },
  { min: 40, label: 'ضعیف', color: '#64748b', bg: '#f1f5f9', border: '#94a3b8' },
  { min: 0, label: 'نامناسب', color: '#dc2626', bg: '#fee2e2', border: '#dc2626' },
];
function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

const CONFIDENCE = {
  high: { label: 'اعتماد بالا', cls: 'bg-green-50 text-green-700 border-green-200' },
  medium: { label: 'اعتماد متوسط', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'اعتماد کم', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;

const TYPE_LABELS: Record<string, string> = Object.values(PROPERTY_TYPES).flat().reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<string, string>,
);

const ROLE_LABELS: Record<string, string> = {
  buyer: 'خریدار', seller: 'فروشنده', owner: 'مالک', applicant: 'متقاضی', builder: 'سازنده',
};

const FEATURE_LABELS_UI: Record<string, string> = {
  parking: 'پارکینگ', elevator: 'آسانسور', storage: 'انباری', balcony: 'بالکن',
  yard: 'حیاط', garden: 'باغ', pool: 'استخر', security: 'امنیت',
  fireplace: 'آتشکده', fountain: 'آبنما', jacuzzi: 'جکوزی', gazebo: 'آلاچیق',
  bbq: 'باربیکیو', sauna: 'سونا', caretaker: 'سرایدار', mezzanine: 'بالکن تجاری',
  electric_shutter: 'کرکره برقی', signage: 'تابلوخور', restroom: 'سرویس بهداشتی',
  walled: 'چهاردیواری', water_well: 'چاه آب', office_space: 'فضای اداری',
  ceiling_crane: 'جرثقیل', water: 'آب', electricity: 'برق', gas: 'گاز',
};

// امکاناتی که ستون واقعی در فایل دارند (بقیه قابل تأیید نیستند)
const VERIFY_FEATURES: [string, string][] = [
  ['parking', 'پارکینگ'], ['elevator', 'آسانسور'], ['storage', 'انباری'], ['balcony', 'بالکن'],
  ['yard', 'حیاط'], ['garden', 'باغ'], ['pool', 'استخر'], ['security', 'امنیت'],
];

// ---- ابزارهای متن (اعداد فارسی) ----
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const moneyRange = (lo: unknown, hi: unknown): string | null => {
  const a = num(lo); const b = num(hi);
  if (a == null && b == null) return null;
  if (a != null && b != null) return `${formatMoneyShort(a)} تا ${formatMoneyShort(b)}`;
  if (a != null) return `از ${formatMoneyShort(a)}`;
  return `تا ${formatMoneyShort(b)}`;
};

const areaRange = (lo: unknown, hi: unknown): string | null => {
  const a = num(lo); const b = num(hi);
  if (a == null && b == null) return null;
  if (a != null && b != null) return `${formatPrice(a)} تا ${formatPrice(b)} متر`;
  if (a != null) return `از ${formatPrice(a)} متر`;
  return `تا ${formatPrice(b)} متر`;
};

type GeoNames = Record<string, string>; // 'c:id' | 'ci:id' | 'n:id' → نام

const locText = (geo: GeoNames, county?: string | null, hood?: string | null, cityIds?: string[]): string | null => {
  const parts: string[] = [];
  if (county && geo['c:' + county]) parts.push(geo['c:' + county]);
  if (hood && geo['n:' + hood]) parts.push(geo['n:' + hood]);
  const cities = (cityIds ?? []).map((id) => geo['ci:' + id]).filter(Boolean);
  if (cities.length > 0) parts.push(cities.join('، '));
  return parts.length > 0 ? parts.join(' — ') : null;
};

// ---- ردیف‌های داده «با یک نگاه» ----

interface SpecRow { k: string; v: string }

const customerRequestRows = (c: Customer, bestType: string | null, geo: GeoNames): SpecRow[] => {
  const rows: SpecRow[] = [];
  const pp = (c.property_preferences ?? null) as Record<string, unknown> | null;
  const pref = (key: string): unknown => {
    if (!pp) return undefined;
    const order = [bestType, ...(c.preferred_property_types ?? [])].filter((t): t is string => Boolean(t));
    for (const t of order) {
      const v = (pp[t] as Record<string, unknown> | undefined)?.[key];
      if (v != null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
  if (c.transaction_intention) {
    rows.push({ k: 'نوع معامله', v: [getTransactionLabel(c.transaction_intention), c.transaction_role ? ROLE_LABELS[c.transaction_role] ?? c.transaction_role : null].filter(Boolean).join(' / ') });
  }
  const types = (c.preferred_property_types ?? []).filter(Boolean);
  if (types.length > 0) rows.push({ k: 'نوع ملک', v: types.map((t) => TYPE_LABELS[t] ?? t).join('، ') });
  const tx = c.transaction_intention;
  if (tx !== 'rent') {
    const r = moneyRange(pref('budget_min'), pref('budget_max'));
    if (r) rows.push({ k: tx === 'sell' ? 'قیمت دلخواه' : 'بودجه', v: r });
  }
  if (tx === 'rent') {
    const dep = moneyRange(pref('deposit_min'), pref('deposit_max'));
    if (dep) rows.push({ k: 'ودیعه', v: dep });
    const rent = moneyRange(pref('rent_min'), pref('rent_max'));
    if (rent) rows.push({ k: 'اجاره ماهانه', v: rent });
  }
  if (tx === 'partnership') {
    const lv = num(pref('land_value'));
    if (lv != null && lv > 0) rows.push({ k: 'ارزش زمین', v: formatMoneyShort(lv) });
    const cb = moneyRange(pref('construction_budget_min'), pref('construction_budget_max'));
    if (cb) rows.push({ k: 'بودجه ساخت', v: cb });
  }
  const ar = areaRange(pref('min_area'), pref('max_area'));
  if (ar) rows.push({ k: 'متراژ', v: ar });
  const lr = areaRange(pref('min_land_area'), pref('max_land_area'));
  if (lr) rows.push({ k: 'متراژ زمین', v: lr });
  const hall = num(pref('min_hall_area'));
  if (hall != null) rows.push({ k: 'سالن', v: `از ${formatPrice(hall)} متر` });
  const rooms = num(pref('min_rooms'));
  if (rooms != null) rows.push({ k: 'خواب', v: `${formatPrice(rooms)}+` });
  const floor = num(pref('preferred_floor'));
  if (floor != null) rows.push({ k: 'طبقه', v: floor === 0 ? 'همکف' : `طبقه ${formatPrice(floor)}` });
  const loc = (pp?.location ?? null) as { county_id?: string; neighborhood_id?: string } | null;
  const lt = locText(geo, loc?.county_id, loc?.neighborhood_id, c.preferred_city_ids);
  if (lt) rows.push({ k: 'موقعیت', v: lt });
  const feats = Object.keys(FEATURE_LABELS_UI).filter((k) => pref(k) === true);
  if (feats.length > 0) {
    rows.push({ k: 'امکانات', v: feats.slice(0, 3).map((f) => FEATURE_LABELS_UI[f]).join('، ') + (feats.length > 3 ? ` +${formatPrice(feats.length - 3)}` : '') });
  }
  return rows;
};

const propertyFactsRows = (p: Property, geo: GeoNames): SpecRow[] => {
  const rows: SpecRow[] = [];
  rows.push({ k: 'نوع معامله', v: getTransactionLabel(p.transaction_type) });
  if (p.property_type) rows.push({ k: 'نوع ملک', v: TYPE_LABELS[p.property_type] ?? p.property_type });
  if (p.sale_price > 0) {
    rows.push({ k: 'قیمت', v: formatMoneyShort(p.sale_price) });
  } else if (p.deposit_price > 0) {
    rows.push({ k: 'قیمت', v: formatMoneyShort(p.deposit_price) + (p.monthly_rent > 0 ? ` + ${formatMoneyShort(p.monthly_rent)} ماهانه` : '') });
  }
  const b = p.building_area > 0 ? p.building_area : null;
  const l = p.land_area > 0 ? p.land_area : null;
  if (b != null && l != null) rows.push({ k: 'متراژ', v: `زیربنا ${formatPrice(b)} / زمین ${formatPrice(l)} متر` });
  else if (b != null) rows.push({ k: 'متراژ', v: `${formatPrice(b)} متر` });
  else if (l != null) rows.push({ k: 'متراژ', v: `${formatPrice(l)} متر زمین` });
  if (p.bedrooms > 0) rows.push({ k: 'خواب', v: formatPrice(p.bedrooms) });
  if (p.rooms > 0 && p.rooms !== p.bedrooms) rows.push({ k: 'اتاق', v: formatPrice(p.rooms) });
  if (p.floor > 0 || p.total_floors > 0) rows.push({ k: 'طبقه', v: (p.floor === 0 ? 'همکف' : `طبقه ${formatPrice(p.floor)}`) + (p.total_floors > 0 ? ` از ${formatPrice(p.total_floors)}` : '') });
  if (p.building_age > 0) rows.push({ k: 'سن', v: `${formatPrice(p.building_age)} سال` });
  if (p.negotiable) rows.push({ k: 'مذاکره', v: 'قابل مذاکره' });
  const lt = locText(geo, p.county_id, p.neighborhood_id, p.county_id ? [] : p.city_id ? [p.city_id] : []);
  if (lt) rows.push({ k: 'موقعیت', v: lt });
  return rows;
};

// ---- اجزای کوچک ----

function FeatureChips({ property }: { property: Property }) {
  const has = VERIFY_FEATURES.filter(([k]) => (property as unknown as Record<string, unknown>)[k] === true);
  if (has.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {has.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
          <Check size={9} /> {label}
        </span>
      ))}
    </div>
  );
}

function SpecPanel({ title, icon: Icon, rows, children, tone }: {
  title: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  rows: SpecRow[];
  children?: ReactNode;
  tone: 'blue' | 'slate';
}) {
  const toneCls = tone === 'blue'
    ? { box: 'bg-blue-50/50 border-blue-100', head: 'text-blue-600' }
    : { box: 'bg-slate-50 border-slate-200', head: 'text-slate-500' };
  return (
    <div className={`rounded-lg border p-2.5 ${toneCls.box}`}>
      <p className={`text-[10px] font-bold mb-1.5 flex items-center gap-1 ${toneCls.head}`}>
        <Icon size={10} /> {title}
      </p>
      {rows.length > 0 ? (
        <div className="space-y-0.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-[11px] leading-5">
              <span className="text-slate-400 flex-shrink-0">{r.k}</span>
              <span className="font-semibold text-slate-700 text-left break-words">{r.v}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-300">ثبت نشده</p>
      )}
      {children}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tier = getScoreTier(score);
  const circumference = 2 * Math.PI * 30;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0" dir="ltr">
      <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle
          cx="34" cy="34" r="30" fill="none" stroke={tier.color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-extrabold leading-5" style={{ color: tier.color }}>{score}٪</span>
        <span className="text-[9px] font-medium text-slate-400 mt-0.5">{tier.label}</span>
      </div>
    </div>
  );
}

function TierPill({ score }: { score: number }) {
  const tier = getScoreTier(score);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: tier.bg, color: tier.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tier.color }} />
      {tier.label}
    </span>
  );
}

/** نوارهای مؤلفه: «نوع ملک ۶۰٪ ⚠» */
function ComponentMeters({ components }: { components: ScoredComponent[] }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-y-1.5">
      {components.map((c) => {
        const pct = Math.round(c.value * 100);
        const fill = !c.active ? '#e2e8f0' : c.value >= 0.999 ? '#22c55e' : c.value >= 0.5 ? '#f59e0b' : '#ef4444';
        return (
          <div key={c.key} className="flex items-center gap-2" title={c.active ? `${c.label}: ${pct}٪` : `${c.label}: توسط مشتری ثبت نشده`}>
            <span className="w-16 flex-shrink-0 text-[11px] font-medium text-slate-500">{c.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: fill }} />
            </div>
            <span className="w-9 flex-shrink-0 text-[11px] font-bold text-slate-600 text-left" dir="ltr">{pct}%</span>
            <span className="w-4 flex-shrink-0 flex justify-center">
              {!c.active ? <Minus size={12} className="text-slate-300" />
                : c.value >= 0.999 ? <Check size={13} className="text-green-600" />
                : <AlertTriangle size={12} className="text-amber-500" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ReasonLine { icon: 'ok' | 'warn' | 'info'; text: string }

function ReasonList({ lines }: { lines: ReasonLine[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? lines : lines.slice(0, 8);
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
        <Info size={12} /> دلایل تطبیق
      </p>
      <div className="space-y-1.5">
        {visible.map((l, i) => (
          <div key={i} className="flex items-start gap-2 text-xs leading-5">
            {l.icon === 'ok' && <span className="mt-0.5 w-4 h-4 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><Check size={10} /></span>}
            {l.icon === 'warn' && <span className="mt-0.5 w-4 h-4 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0"><AlertTriangle size={9} /></span>}
            {l.icon === 'info' && <span className="mt-0.5 w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0"><Info size={9} /></span>}
            <span className={l.icon === 'warn' ? 'text-orange-700 font-medium' : l.icon === 'info' ? 'text-slate-400' : 'text-slate-600'}>{l.text}</span>
          </div>
        ))}
      </div>
      {lines.length > 8 && (
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] text-slate-400 mt-2 hover:text-slate-600 transition-colors">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'بستن' : `${formatPrice(lines.length - 8)} مورد دیگر`}
        </button>
      )}
    </div>
  );
}

function FactChip({ icon: Icon, text, tone = 'slate' }: { icon: ComponentType<{ size?: number | string; className?: string }>; text: string; tone?: 'slate' | 'blue' | 'green' | 'gold' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-500 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gold: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      <Icon size={10} /> {text}
    </span>
  );
}

// ---- کارت نتیجه: دیتای کامل هر دو طرف با یک نگاه ----

function MatchCard({ entry, customer, property, geo }: {
  entry: MatchEntry;
  customer: Customer; // سمت «درخواست» این جفت
  property: Property; // سمت «فایل» این جفت
  geo: GeoNames;
}) {
  const result = entry.result;
  const score = result.score ?? 0;
  const tier = getScoreTier(score);
  const conf = result.confidence ? CONFIDENCE[result.confidence] : null;
  const bestType = result.metadata.bestType;

  const name = entry.type === 'customer'
    ? entry.data.name ?? `${entry.data.first_name} ${entry.data.last_name}`
    : entry.data.title;

  const lines: ReasonLine[] = [
    ...(result.explanation?.warnings ?? []).map((text) => ({ icon: 'warn' as const, text })),
    ...(result.explanation?.positives ?? []).map((text) => ({ icon: 'ok' as const, text })),
    ...(result.explanation?.unverifiable ?? []).map((text) => ({ icon: 'info' as const, text })),
  ];

  return (
    <div className="card overflow-hidden transition-all hover:shadow-md" style={{ borderRight: `3px solid ${tier.border}` }}>
      <div className="p-4">
        {/* سربرگ */}
        <div className="flex items-start gap-3">
          {entry.type === 'customer' ? (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              entry.data.temperature === 'hot' ? 'bg-red-100 text-red-600' :
              entry.data.temperature === 'warm' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {name?.[0] ?? '؟'}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={19} className="text-slate-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
              {entry.type === 'customer' && entry.data.temperature === 'hot' && <Flame size={14} className="text-red-500 flex-shrink-0" />}
              <TierPill score={score} />
              {conf && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${conf.cls}`}>
                  <ShieldCheck size={10} /> {conf.label}
                </span>
              )}
              {result.metadata.isSubstitutePropertyType && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <AlertTriangle size={10} /> نوع جایگزین — حداکثر 69٪
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {entry.type === 'customer'
                ? <span dir="ltr">{entry.data.mobile}</span>
                : `${getTransactionLabel(entry.data.transaction_type)} • ${getCategoryLabel(entry.data.category)} • ${getPropertyTypeLabel(entry.data.category, entry.data.property_type)}`}
            </p>
          </div>
          <ScoreRing score={score} />
        </div>

        {/* درخواست ↔ فایل: دادهٔ کامل هر دو طرف */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SpecPanel title="درخواست مشتری" icon={Users} tone="blue" rows={customerRequestRows(customer, bestType, geo)} />
          <SpecPanel title="اطلاعات فایل" icon={Building2} tone="slate" rows={propertyFactsRows(property, geo)}>
            <FeatureChips property={property} />
          </SpecPanel>
        </div>

        {/* مؤلفه‌ها */}
        {result.components && <ComponentMeters components={result.components} />}

        {/* سقف دادهٔ ناقص */}
        {result.caps.includes('INCOMPLETE_PROPERTY_DATA') && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Info size={12} className="flex-shrink-0" /> دادهٔ فایل ناقص است — امتیاز سقف ۷۴٪ دارد
          </p>
        )}

        {/* قانون توضیح اجباری */}
        {lines.length > 0 ? (
          <ReasonList lines={lines} />
        ) : (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 text-[11px] font-medium">
              <Info size={12} /> اطمینان کم — دادهٔ کافی نیست
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- صفحه ----

export function MatchesPage() {
  const [mode, setMode] = useState<'property_to_customer' | 'customer_to_property'>('property_to_customer');
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Property | Customer | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState(55); // آستانهٔ پیش‌فرض نمایش: ۵۵ (§۱۳ سند)
  const [onlyWithMatches, setOnlyWithMatches] = useState(true);
  const [matchCounts, setMatchCounts] = useState<Map<string, number> | null>(null);
  const [persistStatus, setPersistStatus] = useState<{ saved: number; error: string | null } | null>(null);
  const [geoNames, setGeoNames] = useState<GeoNames>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [propsRes, custRes] = await Promise.all([
      supabase.from('properties').select('*').eq('is_active', true).eq('status', 'active').order('created_at', { ascending: false }).limit(100),
      supabase.from('customers').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(100),
    ]);
    setProperties((propsRes.data as Property[]) ?? []);
    setCustomers((custRes.data as Customer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // نام‌های موقعیت (شهرستان/شهر/محله) یک‌بار — برای نمایش «موقعیت: روباط‌کریم — …»
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('counties').select('id, name'),
      supabase.from('cities').select('id, name'),
      supabase.from('neighborhoods').select('id, name'),
    ]).then(([ct, ci, nb]) => {
      if (!active) return;
      const map: GeoNames = {};
      (ct.data ?? []).forEach((r: { id: string; name: string }) => { map['c:' + r.id] = r.name; });
      (ci.data ?? []).forEach((r: { id: string; name: string }) => { map['ci:' + r.id] = r.name; });
      (nb.data ?? []).forEach((r: { id: string; name: string }) => { map['n:' + r.id] = r.name; });
      setGeoNames(map);
    });
    return () => { active = false; };
  }, []);

  // شمارش «تطبیق سازگار» هر مورد — مستقل از فیلتر امتیاز، پس از رندر اولیه
  useEffect(() => {
    setMatchCounts(null);
    const t = setTimeout(() => {
      const map = new Map<string, number>();
      if (mode === 'property_to_customer') {
        for (const p of properties) {
          let n = 0;
          for (const c of customers) if (scoreMatch(c, p).compatible) n++;
          map.set(p.id, n);
        }
      } else {
        for (const c of customers) {
          let n = 0;
          for (const p of properties) if (scoreMatch(c, p).compatible) n++;
          map.set(c.id, n);
        }
      }
      setMatchCounts(map);
    }, 60);
    return () => clearTimeout(t);
  }, [mode, properties, customers]);

  const computeMatches = useCallback((item: Property | Customer) => {
    setSelected(item);
    setComputing(true);
    setPersistStatus(null);

    let results: MatchEntry[] = [];
    let rejected = 0;

    if (mode === 'property_to_customer') {
      const prop = item as Property;
      const pairs = customers.map((c) => ({ property: prop, customer: c, result: scoreMatch(c, prop) }));
      rejected = pairs.filter((p) => !p.result.compatible).length;
      results = rankMatches(pairs)
        .filter((p) => (p.result.score ?? 0) >= minScore)
        .slice(0, 15)
        .map((p) => ({ type: 'customer' as const, data: p.customer, result: p.result }));
      persistMatches(pairs).then(setPersistStatus).catch((e: unknown) => setPersistStatus({ saved: 0, error: String(e) }));
    } else {
      const cust = item as Customer;
      const pairs = properties.map((p) => ({ property: p, customer: cust, result: scoreMatch(cust, p) }));
      rejected = pairs.filter((p) => !p.result.compatible).length;
      results = rankMatches(pairs)
        .filter((p) => (p.result.score ?? 0) >= minScore)
        .slice(0, 15)
        .map((p) => ({ type: 'property' as const, data: p.property, result: p.result }));
      persistMatches(pairs).then(setPersistStatus).catch((e: unknown) => setPersistStatus({ saved: 0, error: String(e) }));
    }

    setMatches(results);
    setRejectedCount(rejected);
    setComputing(false);
  }, [mode, customers, properties, minScore]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (mode === 'property_to_customer') {
      return properties.filter((p) => !q || p.title.toLowerCase().includes(q));
    }
    return customers.filter((c) => {
      const name = (c.name ?? `${c.first_name} ${c.last_name}`).toLowerCase();
      return !q || name.includes(q) || c.mobile.includes(q);
    });
  }, [mode, properties, customers, search]);

  const visibleList = useMemo(() => {
    if (!onlyWithMatches) return filteredList;
    if (!matchCounts) return filteredList;
    return filteredList.filter((item) => (matchCounts.get(item.id) ?? 0) > 0);
  }, [filteredList, onlyWithMatches, matchCounts]);

  const withMatchesCount = matchCounts ? [...matchCounts.values()].filter((n) => n > 0).length : null;

  const avgScore = matches.length > 0 ? Math.round(matches.reduce((s, m) => s + (m.result.score ?? 0), 0) / matches.length) : 0;
  const excellentCount = matches.filter((m) => (m.result.score ?? 0) >= 85).length;

  if (loading) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  const selectedIsProperty = mode === 'property_to_customer';
  // در هر کارت، «درخواست» همیشه مشتری و «فایل» همیشه ملک است — هر دو طرف کامل
  const pairOf = (entry: MatchEntry): { customer: Customer; property: Property } =>
    selectedIsProperty
      ? { customer: entry.type === 'customer' ? entry.data : (selected as Customer), property: selected as Property }
      : { customer: selected as Customer, property: entry.type === 'property' ? entry.data : (selected as Property) };

  return (
    <div className="animate-fade-in">
      <PageHeader title="تطبیق‌ها" />

      {/* انتخاب جهت */}
      <div className="bg-slate-100 rounded-xl p-1 flex gap-1 mb-4">
        <button
          onClick={() => { setMode('property_to_customer'); setSelected(null); setMatches([]); }}
          className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'property_to_customer' ? 'bg-white shadow-sm text-slate-800 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Target size={16} /> فایل ← مشتری
        </button>
        <button
          onClick={() => { setMode('customer_to_property'); setSelected(null); setMatches([]); }}
          className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'customer_to_property' ? 'bg-white shadow-sm text-slate-800 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Zap size={16} /> مشتری ← فایل
        </button>
      </div>

      {!selected ? (
        <>
          {/* نوار ابزار — یک ردیف: جستجو + فیلتر امتیاز + فیلتر فهرست */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pr-9 py-2.5"
                placeholder={mode === 'property_to_customer' ? 'جستجوی فایل...' : 'جستجوی مشتری...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">حداقل امتیاز</span>
              {[40, 50, 55, 65, 75, 85, 95].map((t) => (
                <button
                  key={t}
                  onClick={() => setMinScore(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    minScore === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t}٪
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">فهرست</span>
              <button
                onClick={() => setOnlyWithMatches(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  onlyWithMatches ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                دارای تطبیق{withMatchesCount != null && ` (${formatPrice(withMatchesCount)})`}
              </button>
              <button
                onClick={() => setOnlyWithMatches(false)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  !onlyWithMatches ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                همه{matchCounts && ` (${formatPrice(matchCounts.size)})`}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            {mode === 'property_to_customer' ? `فایل فعال: ${formatPrice(filteredList.length)}` : `مشتری فعال: ${formatPrice(filteredList.length)}`}
            {visibleList.length !== filteredList.length && ` • نمایش: ${formatPrice(visibleList.length)}`}
            {' • '}فقط جفت‌های سازگار با امتیاز ≥ {minScore}٪ نمایش داده می‌شوند
          </p>

          {filteredList.length === 0 ? (
            <EmptyState
              icon={mode === 'property_to_customer' ? <Building2 size={48} /> : <Users size={48} />}
              title={mode === 'property_to_customer' ? 'فایلی یافت نشد' : 'مشتری‌ای یافت نشد'}
            />
          ) : visibleList.length === 0 ? (
            <EmptyState
              icon={<Target size={48} />}
              title="هیچ موردی تطبیق سازگار ندارد"
              description="برای دیدن همهٔ موارد، فیلتر فهرست را روی «همه» بگذارید"
            />
          ) : (
            <div className="space-y-2">
              {visibleList.map((item) => {
                if (mode === 'property_to_customer') {
                  const p = item as Property;
                  const area = p.building_area > 0 ? p.building_area : p.land_area;
                  const priceTxt = p.sale_price > 0 ? formatMoneyShort(p.sale_price) : p.deposit_price > 0 ? formatMoneyShort(p.deposit_price) : null;
                  return (
                    <div
                      key={p.id}
                      onClick={() => computeMatches(p)}
                      className="card p-3.5 cursor-pointer hover:shadow-md transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={18} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {p.is_hot && <Flame size={13} className="text-red-500 flex-shrink-0" />}
                            <p className="text-sm font-bold text-slate-800 truncate">{p.title}</p>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {getTransactionLabel(p.transaction_type)} • {getCategoryLabel(p.category)} • {getPropertyTypeLabel(p.category, p.property_type)}
                            {locText(geoNames, p.county_id, p.neighborhood_id, p.county_id ? [] : p.city_id ? [p.city_id] : []) && ` • ${locText(geoNames, p.county_id, p.neighborhood_id, p.county_id ? [] : p.city_id ? [p.city_id] : [])}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {area > 0 && <FactChip icon={Ruler} text={`${formatPrice(area)} متری`} />}
                            {p.bedrooms > 0 && <FactChip icon={BedDouble} text={`${formatPrice(p.bedrooms)} خواب`} />}
                            {priceTxt && <FactChip icon={Wallet} text={priceTxt} tone="blue" />}
                            {p.negotiable && <FactChip icon={TrendingUp} text="قابل مذاکره" tone="gold" />}
                            {matchCounts && (
                              (matchCounts.get(p.id) ?? 0) > 0
                                ? <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700"><Target size={10} /> {formatPrice(matchCounts.get(p.id) ?? 0)} تطبیق</span>
                                : <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">بدون تطبیق</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                const c = item as Customer;
                const temp = getTemperatureInfo(c.temperature);
                const firstType = (c.preferred_property_types ?? [])[0];
                return (
                  <div
                    key={c.id}
                    onClick={() => computeMatches(c)}
                    className="card p-3.5 cursor-pointer hover:shadow-md transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        c.temperature === 'hot' ? 'bg-red-100 text-red-600' :
                        c.temperature === 'warm' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {(c.name ?? c.first_name)?.[0] ?? '؟'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-800 truncate">{c.name ?? `${c.first_name} ${c.last_name}`}</p>
                          {c.temperature === 'hot' && <Flame size={13} className="text-red-500 flex-shrink-0" />}
                          <span className="text-[10px] text-slate-400">{temp.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5" dir="ltr">{c.mobile}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {c.transaction_intention && <FactChip icon={Zap} text={getTransactionLabel(c.transaction_intention)} tone="green" />}
                          {firstType && <FactChip icon={Home} text={TYPE_LABELS[firstType] ?? firstType} />}
                          {matchCounts && (
                            (matchCounts.get(c.id) ?? 0) > 0
                              ? <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700"><Target size={10} /> {formatPrice(matchCounts.get(c.id) ?? 0)} تطبیق</span>
                              : <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">بدون تطبیق</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : computing ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Spinner size={32} />
          <p className="text-sm text-slate-400">در حال محاسبه تطبیق‌ها...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* پروندهٔ مورد انتخاب‌شده — دادهٔ کامل */}
          <div className="card p-4 bg-gradient-to-l from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelected(null); setMatches([]); }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 transition-all"
              >
                <ArrowLeft size={14} /> بازگشت
              </button>
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                {selectedIsProperty ? <Building2 size={18} className="text-white" /> : <Users size={18} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {selectedIsProperty
                    ? `فایل: ${(selected as Property).title}`
                    : `مشتری: ${(selected as Customer).name ?? `${(selected as Customer).first_name} ${(selected as Customer).last_name}`}`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {selectedIsProperty
                    ? (() => { const p = selected as Property; return `${getTransactionLabel(p.transaction_type)} • ${getCategoryLabel(p.category)} • ${getPropertyTypeLabel(p.category, p.property_type)}`; })()
                    : (() => { const c = selected as Customer; return [c.transaction_intention ? getTransactionLabel(c.transaction_intention) : null, c.transaction_role ? ROLE_LABELS[c.transaction_role] ?? c.transaction_role : null, c.temperature ? getTemperatureInfo(c.temperature).label : null].filter(Boolean).join(' • '); })()}
                </p>
              </div>
            </div>

            {/* پنل دادهٔ کامل حذف شد — دادهٔ هر دو طرف در حالت مقایسه‌ای هر کارت نمایش داده می‌شود */}

            {/* تایل‌های آمار */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 h-full">
                <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><Target size={16} /></span>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-800 leading-5">{formatPrice(matches.length)}</p>
                  <p className="text-[10px] text-slate-400">تطبیق ≥ {minScore}٪</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 h-full">
                <span className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><TrendingUp size={16} /></span>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-800 leading-5">{matches.length > 0 ? `${avgScore}٪` : '—'}</p>
                  <p className="text-[10px] text-slate-400">میانگین امتیاز</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 h-full">
                <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Star size={16} /></span>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-800 leading-5">{formatPrice(excellentCount)}</p>
                  <p className="text-[10px] text-slate-400">عالی (≥ 85٪)</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 h-full">
                <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><X size={16} /></span>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-800 leading-5">{formatPrice(rejectedCount)}</p>
                  <p className="text-[10px] text-slate-400">ناسازگار (رد شد)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
              <span className="text-[10px] text-slate-400">
                تیرها:
                {SCORE_TIERS.slice(0, 4).map((t) => (
                  <span key={t.label} className="inline-flex items-center gap-1 mx-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label} {t.min}+
                  </span>
                ))}
              </span>
              <span className="text-[10px] text-slate-300 mr-auto">
                {persistStatus
                  ? (persistStatus.error ? <span className="text-red-500">⚠ {persistStatus.error}</span> : `✓ ${formatPrice(persistStatus.saved)} تطبیق ذخیره شد`)
                  : 'در حال ذخیره...'}
              </span>
            </div>
          </div>

          {/* نتایج */}
          {matches.length === 0 ? (
            <EmptyState
              icon={<Target size={48} />}
              title="تطبیقی با امتیاز کافی یافت نشد"
              description={`فقط جفت‌های سازگار و با امتیاز حداقل ${minScore}٪ نمایش داده می‌شوند — ${formatPrice(rejectedCount)} جفت ناسازگار حذف شد`}
            />
          ) : (
            <div className="space-y-3">
              {matches.map((m, i) => {
                const pair = pairOf(m);
                return <MatchCard key={i} entry={m} customer={pair.customer} property={pair.property} geo={geoNames} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
