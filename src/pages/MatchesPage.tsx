import { useEffect, useState, useCallback, useMemo } from 'react';
import { Target, ArrowLeft, Zap, Search, TrendingUp, Check, X, ChevronDown, ChevronUp, Building2, Users, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateMatch, type MatchResult } from '@/lib/matching';
import { formatPrice, getTransactionLabel, getCategoryLabel, getPropertyTypeLabel, getTemperatureInfo } from '@/lib/constants';
import { Badge, EmptyState, Spinner, PageHeader } from '@/components/ui';
import type { Property, Customer } from '@/lib/types';

interface MatchCardProps {
  score: number;
  factors: { label: string; matched: boolean }[];
  differences: { label: string; detail: string }[];
}

type MatchEntry =
  | { type: 'customer'; data: Customer; result: MatchResult }
  | { type: 'property'; data: Property; result: MatchResult };

const SCORE_TIERS = [
  { min: 85, label: 'عالی', color: '#16a34a', bg: '#dcfce7' },
  { min: 70, label: 'خوب', color: '#65a30d', bg: '#ecfccb' },
  { min: 55, label: 'متوسط', color: '#f97316', bg: '#ffedd5' },
  { min: 40, label: 'ضعیف', color: '#64748b', bg: '#f1f5f9' },
  { min: 0, label: 'نامناسب', color: '#dc2626', bg: '#fee2e2' },
];

function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

function ScoreRing({ score }: { score: number }) {
  const tier = getScoreTier(score);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="32" cy="32" r="28" fill="none" stroke={tier.color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color: tier.color }}>{score}%</span>
        <span className="text-[9px] text-slate-400">{tier.label}</span>
      </div>
    </div>
  );
}

function FactorChip({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      matched ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
    }`}>
      {matched ? <Check size={11} /> : <X size={11} />}
      {label}
    </span>
  );
}

function MatchCard({ entry }: { entry: MatchEntry }) {
  const [expanded, setExpanded] = useState(false);
  const tier = getScoreTier(entry.result.score);

  const name = entry.type === 'customer'
    ? entry.data.name ?? `${entry.data.first_name} ${entry.data.last_name}`
    : entry.data.title;

  const subtitle = entry.type === 'customer'
    ? entry.data.mobile
    : `${getTransactionLabel(entry.data.transaction_type)} • ${getCategoryLabel(entry.data.category)} • ${getPropertyTypeLabel(entry.data.category, entry.data.property_type)}`;

  const priceLabel = entry.type === 'property'
    ? (entry.data.sale_price != null ? `${formatPrice(entry.data.sale_price)} ت` :
       entry.data.deposit_price != null ? `رهن: ${formatPrice(entry.data.deposit_price)}` : '')
    : (entry.data.temperature === 'hot' ? 'مشتری داغ' : '');

  return (
    <div className="card overflow-hidden transition-all" style={{ borderLeft: `3px solid ${tier.color}` }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {entry.type === 'customer' ? (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              entry.data.temperature === 'hot' ? 'bg-red-100 text-red-600' :
              entry.data.temperature === 'warm' ? 'bg-orange-100 text-orange-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              {name?.[0] ?? '؟'}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-slate-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
              {entry.type === 'customer' && entry.data.temperature === 'hot' && <Flame size={14} className="text-red-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-slate-400 truncate" dir={entry.type === 'customer' ? 'ltr' : 'rtl'}>{subtitle}</p>
            {priceLabel && <p className="text-xs text-slate-500 mt-0.5">{priceLabel}</p>}
          </div>
          <ScoreRing score={entry.result.score} />
        </div>

        {/* Factors */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {entry.result.factors.map((f, i) => <FactorChip key={i} label={f.label} matched={f.matched} />)}
        </div>

        {/* Differences preview */}
        {entry.result.differences.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-orange-600 mt-3 hover:text-orange-700"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {entry.result.differences.length} مورد تفاوت
          </button>
        )}

        {/* Expanded differences */}
        {expanded && entry.result.differences.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 animate-fade-in">
            {entry.result.differences.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-slate-400 font-medium min-w-fit">{d.label}:</span>
                <span className="text-orange-600">{d.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchesPage() {
  const [mode, setMode] = useState<'property_to_customer' | 'customer_to_property'>('property_to_customer');
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Property | Customer | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState(40);

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

  const computeMatches = useCallback((item: Property | Customer) => {
    setSelected(item);
    setComputing(true);

    if (mode === 'property_to_customer') {
      const prop = item as Property;
      const results: MatchEntry[] = customers
        .map((c) => ({ type: 'customer' as const, data: c, result: calculateMatch(prop, c) }))
        .filter((m) => m.result.score >= minScore)
        .sort((a, b) => b.result.score - a.result.score)
        .slice(0, 15);
      setMatches(results);
    } else {
      const cust = item as Customer;
      const results: MatchEntry[] = properties
        .map((p) => ({ type: 'property' as const, data: p, result: calculateMatch(p, cust) }))
        .filter((m) => m.result.score >= minScore)
        .sort((a, b) => b.result.score - a.result.score)
        .slice(0, 15);
      setMatches(results);
    }
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

  const avgScore = matches.length > 0 ? Math.round(matches.reduce((s, m) => s + m.result.score, 0) / matches.length) : 0;
  const excellentCount = matches.filter((m) => m.result.score >= 85).length;

  if (loading) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="تطبیق‌ها" subtitle="موتور تطبیق هوشمند فایل و مشتری" />

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('property_to_customer'); setSelected(null); setMatches([]); }}
          className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${mode === 'property_to_customer' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <Target size={18} className="inline ml-1" /> فایل ← مشتری
        </button>
        <button
          onClick={() => { setMode('customer_to_property'); setSelected(null); setMatches([]); }}
          className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${mode === 'customer_to_property' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <Zap size={18} className="inline ml-1" /> مشتری ← فایل
        </button>
      </div>

      {!selected ? (
        <>
          <div className="relative mb-4">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pr-10"
              placeholder={mode === 'property_to_customer' ? 'جستجوی فایل...' : 'جستجوی مشتری...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Min score filter */}
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="text-slate-500">حداقل امتیاز تطبیق:</span>
            {[40, 55, 70, 85].map((t) => (
              <button
                key={t}
                onClick={() => setMinScore(t)}
                className={`px-2.5 py-1 rounded-full font-medium transition-all ${minScore === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {t}%
              </button>
            ))}
          </div>

          {filteredList.length === 0 ? (
            <EmptyState
              icon={mode === 'property_to_customer' ? <Building2 size={48} /> : <Users size={48} />}
              title={mode === 'property_to_customer' ? 'فایلی یافت نشد' : 'مشتری‌ای یافت نشد'}
            />
          ) : (
            <div className="space-y-2">
              {filteredList.map((item) => {
                if (mode === 'property_to_customer') {
                  const p = item as Property;
                  return (
                    <div
                      key={p.id}
                      onClick={() => computeMatches(p)}
                      className="card p-4 cursor-pointer hover:shadow-md transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {p.is_hot && <Flame size={14} className="text-red-500 flex-shrink-0" />}
                            <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {getTransactionLabel(p.transaction_type)} • {getCategoryLabel(p.category)} • {getPropertyTypeLabel(p.category, p.property_type)}
                          </p>
                        </div>
                        <div className="text-left flex-shrink-0">
                          {p.sale_price != null && <span className="text-sm font-bold text-slate-700">{formatPrice(p.sale_price)} ت</span>}
                          {p.deposit_price != null && <span className="text-xs text-slate-500">رهن: {formatPrice(p.deposit_price)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }
                const c = item as Customer;
                const temp = getTemperatureInfo(c.temperature);
                return (
                  <div
                    key={c.id}
                    onClick={() => computeMatches(c)}
                    className="card p-4 cursor-pointer hover:shadow-md transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          c.temperature === 'hot' ? 'bg-red-100 text-red-600' :
                          c.temperature === 'warm' ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {(c.name ?? c.first_name)?.[0] ?? '؟'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800 truncate">{c.name ?? `${c.first_name} ${c.last_name}`}</p>
                            {c.temperature === 'hot' && <Badge color="red">{temp.label}</Badge>}
                          </div>
                          <p className="text-xs text-slate-400" dir="ltr">{c.mobile}</p>
                        </div>
                      </div>
                      {c.transaction_intention && <Badge color="gray">{getTransactionLabel(c.transaction_intention)}</Badge>}
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
          {/* Back button */}
          <button
            onClick={() => { setSelected(null); setMatches([]); }}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> بازگشت
          </button>

          {/* Selected item summary */}
          <div className="card p-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {mode === 'property_to_customer'
                    ? `فایل: ${(selected as Property).title}`
                    : `مشتری: ${(selected as Customer).name ?? `${(selected as Customer).first_name} ${(selected as Customer).last_name}`}`}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {matches.length} تطبیق یافت شد
                  {matches.length > 0 && ` • میانگین: ${avgScore}% • عالی: ${excellentCount}`}
                </p>
              </div>
              <TrendingUp size={20} className="text-slate-300" />
            </div>
          </div>

          {/* Match results */}
          {matches.length === 0 ? (
            <EmptyState
              icon={<Target size={48} />}
              title="تطبیقی با امتیاز کافی یافت نشد"
              description={`تطبیق‌هایی با امتیاز حداقل ${minScore}٪ نمایش داده می‌شوند`}
            />
          ) : (
            matches.map((m, i) => <MatchCard key={i} entry={m} />)
          )}
        </div>
      )}
    </div>
  );
}
