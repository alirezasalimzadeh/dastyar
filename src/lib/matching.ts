import type { Property, Customer, MatchFactor, MatchDifference } from '@/lib/types';

export interface MatchResult {
  score: number;
  factors: MatchFactor[];
  differences: MatchDifference[];
}

const WEIGHTS = {
  transaction: 15,
  category: 10,
  propertyType: 10,
  location: 20,
  budget: 20,
  area: 10,
  rooms: 5,
  floor: 5,
  features: 5,
};

const COMPLEMENTARY: Record<string, string[]> = {
  buy: ['sell', 'buy'],
  sell: ['buy', 'sell'],
  rent: ['rent'],
  partnership: ['partnership'],
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true';
}

interface TypePrefs {
  [key: string]: string | number | boolean | null;
}

function getTypePrefs(customer: Customer, propertyType: string): TypePrefs {
  const pp = customer.property_preferences as Record<string, unknown> | null;
  if (!pp) return {};
  const tp = pp[propertyType] as TypePrefs | undefined;
  return tp ?? {};
}

function getLocationPrefs(customer: Customer): { county_id?: string; city_id?: string; neighborhood_id?: string } {
  const pp = customer.property_preferences as Record<string, unknown> | null;
  if (!pp) return {};
  return (pp.location as { county_id?: string; city_id?: string; neighborhood_id?: string }) ?? {};
}

export function calculateMatch(property: Property, customer: Customer): MatchResult {
  const factors: MatchFactor[] = [];
  const differences: MatchDifference[] = [];
  let score = 0;
  let earned = 0;
  let total = 0;

  // --- Transaction type ---
  total += WEIGHTS.transaction;
  const complementary = COMPLEMENTARY[customer.transaction_intention ?? ''] ?? [];
  const transactionMatch = complementary.includes(property.transaction_type);
  factors.push({ label: 'نوع معامله', matched: transactionMatch });
  if (transactionMatch) { score += WEIGHTS.transaction; earned += WEIGHTS.transaction; }

  // --- Category ---
  total += WEIGHTS.category;
  const categoryMatch = customer.preferred_category === property.category;
  factors.push({ label: 'دسته‌بندی', matched: categoryMatch });
  if (categoryMatch) { score += WEIGHTS.category; earned += WEIGHTS.category; }

  // --- Property type ---
  total += WEIGHTS.propertyType;
  const ptMatch = !customer.preferred_property_types?.length || customer.preferred_property_types.includes(property.property_type);
  factors.push({ label: 'نوع ملک', matched: ptMatch });
  if (ptMatch) { score += WEIGHTS.propertyType; earned += WEIGHTS.propertyType; }

  // --- Location ---
  total += WEIGHTS.location;
  const custLoc = getLocationPrefs(customer);
  let locScore = 0;
  let locLabel = 'بدون محدودیت';

  if (custLoc.neighborhood_id || custLoc.city_id || custLoc.county_id) {
    if (custLoc.neighborhood_id && property.neighborhood_id) {
      if (custLoc.neighborhood_id === property.neighborhood_id) { locScore = WEIGHTS.location; locLabel = 'محله'; }
      else locLabel = 'محله متفاوت';
    } else if (custLoc.city_id && property.city_id) {
      if (custLoc.city_id === property.city_id) { locScore = WEIGHTS.location * 0.85; locLabel = 'شهر'; }
      else locLabel = 'شهر متفاوت';
    } else if (custLoc.county_id && property.county_id) {
      if (custLoc.county_id === property.county_id) { locScore = WEIGHTS.location * 0.7; locLabel = 'شهرستان'; }
      else locLabel = 'شهرستان متفاوت';
    } else if (custLoc.county_id && !property.county_id) {
      locLabel = 'شهرستان مشتری نامشخص در فایل';
    } else if (custLoc.city_id && !property.city_id) {
      locLabel = 'شهر مشتری نامشخص در فایل';
    }
  } else {
    locScore = WEIGHTS.location * 0.5;
  }

  factors.push({ label: `موقعیت (${locLabel})`, matched: locScore > 0 });
  score += locScore;
  earned += locScore;

  // --- Get type-specific preferences ---
  const tp = getTypePrefs(customer, property.property_type);
  const isRent = property.transaction_type === 'rent';
  const isBuySell = property.transaction_type === 'buy' || property.transaction_type === 'sell';

  // --- Budget / Price ---
  total += WEIGHTS.budget;
  let budgetScore = 0;

  if (isRent) {
    const depositMin = num(tp.deposit_min);
    const depositMax = num(tp.deposit_max);
    const rentMin = num(tp.rent_min);
    const rentMax = num(tp.rent_max);
    const propDeposit = property.deposit_price ?? 0;
    const propRent = property.monthly_rent ?? 0;

    if (depositMax != null && propDeposit > 0) {
      if (propDeposit >= (depositMin ?? 0) && propDeposit <= depositMax) {
        budgetScore += WEIGHTS.budget * 0.6;
      } else if (propDeposit > depositMax) {
        const over = Math.round(((propDeposit - depositMax) / depositMax) * 100);
        if (over <= 10) budgetScore += WEIGHTS.budget * 0.4;
        differences.push({ label: 'ودیعه', detail: `${over}٪ بالاتر از بودجه` });
      } else {
        differences.push({ label: 'ودیعه', detail: `${Math.round(depositMax - propDeposit)} تومان کمتر` });
        budgetScore += WEIGHTS.budget * 0.3;
      }
    }

    if (rentMax != null && propRent > 0) {
      if (propRent >= (rentMin ?? 0) && propRent <= rentMax) {
        budgetScore += WEIGHTS.budget * 0.4;
      } else if (propRent > rentMax) {
        const over = Math.round(((propRent - rentMax) / rentMax) * 100);
        if (over <= 15) budgetScore += WEIGHTS.budget * 0.2;
        differences.push({ label: 'اجاره', detail: `${over}٪ بالاتر از بودجه` });
      } else {
        differences.push({ label: 'اجاره', detail: `${Math.round(rentMax - propRent)} تومان کمتر` });
        budgetScore += WEIGHTS.budget * 0.15;
      }
    }

    if (depositMax == null && rentMax == null) budgetScore = WEIGHTS.budget * 0.5;
  } else if (isBuySell) {
    const budgetMin = num(tp.budget_min);
    const budgetMax = num(tp.budget_max);
    const propPrice = property.sale_price ?? 0;

    if (budgetMax != null && propPrice > 0) {
      if (propPrice >= (budgetMin ?? 0) && propPrice <= budgetMax) {
        budgetScore = WEIGHTS.budget;
      } else if (propPrice > budgetMax) {
        const over = Math.round(((propPrice - budgetMax) / budgetMax) * 100);
        if (over <= 10) budgetScore = WEIGHTS.budget * 0.7;
        else if (over <= 20) budgetScore = WEIGHTS.budget * 0.4;
        differences.push({ label: 'قیمت', detail: `${over}٪ بالاتر از بودجه` });
      } else {
        const under = Math.round(((budgetMin! - propPrice) / budgetMin!) * 100);
        budgetScore = WEIGHTS.budget * 0.5;
        differences.push({ label: 'قیمت', detail: `${under}٪ کمتر از حداقل بودجه` });
      }
    } else {
      budgetScore = WEIGHTS.budget * 0.5;
    }
  } else {
    // Partnership
    const landValue = num(tp.land_value);
    const expectedShare = num(tp.expected_share);
    if (landValue != null || expectedShare != null) {
      budgetScore = WEIGHTS.budget * 0.6;
    } else {
      budgetScore = WEIGHTS.budget * 0.5;
    }
  }

  factors.push({ label: 'بودجه', matched: budgetScore >= WEIGHTS.budget * 0.7 });
  score += budgetScore;
  earned += budgetScore;

  // --- Area ---
  total += WEIGHTS.area;
  let areaScore = 0;
  const minArea = num(tp.min_area);
  const maxArea = num(tp.max_area);
  const exactArea = num(tp.area);
  const propArea = property.land_area ?? property.building_area ?? 0;

  if (propArea > 0) {
    if (minArea != null && maxArea != null) {
      if (propArea >= minArea && propArea <= maxArea) {
        areaScore = WEIGHTS.area;
      } else if (propArea > maxArea) {
        const over = Math.round(((propArea - maxArea) / maxArea) * 100);
        if (over <= 15) areaScore = WEIGHTS.area * 0.7;
        differences.push({ label: 'متراژ', detail: `${Math.round(propArea - maxArea)} متر بیشتر` });
      } else {
        differences.push({ label: 'متراژ', detail: `${Math.round(minArea - propArea)} متر کمتر` });
      }
    } else if (exactArea != null) {
      const diff = Math.abs(propArea - exactArea);
      const pct = (diff / exactArea) * 100;
      if (pct <= 10) areaScore = WEIGHTS.area;
      else if (pct <= 20) areaScore = WEIGHTS.area * 0.6;
      else areaScore = WEIGHTS.area * 0.3;
      if (pct > 10) differences.push({ label: 'متراژ', detail: `${Math.round(diff)} متر اختلاف` });
    } else {
      areaScore = WEIGHTS.area * 0.5;
    }
  } else {
    areaScore = WEIGHTS.area * 0.5;
  }

  factors.push({ label: 'متراژ', matched: areaScore >= WEIGHTS.area * 0.7 });
  score += areaScore;
  earned += areaScore;

  // --- Rooms / Bedrooms ---
  total += WEIGHTS.rooms;
  let roomsScore = 0;
  const minRooms = num(tp.min_rooms);
  const propRooms = property.bedrooms ?? property.rooms ?? 0;

  if (minRooms != null && propRooms > 0) {
    if (propRooms >= minRooms) {
      roomsScore = WEIGHTS.rooms;
    } else {
      roomsScore = WEIGHTS.rooms * 0.3;
      differences.push({ label: 'تعداد اتاق', detail: `${minRooms - propRooms} اتاق کمتر` });
    }
  } else {
    roomsScore = WEIGHTS.rooms * 0.5;
  }
  factors.push({ label: 'تعداد اتاق', matched: roomsScore >= WEIGHTS.rooms * 0.8 });
  score += roomsScore;
  earned += roomsScore;

  // --- Floor preference ---
  total += WEIGHTS.floor;
  let floorScore = 0;
  const floorPref = tp.floor_preference as string | undefined;
  const propFloor = property.floor ?? 0;
  const propTotalFloors = property.total_floors ?? 0;

  if (floorPref && propFloor > 0 && propTotalFloors > 0) {
    switch (floorPref) {
      case 'high':
        if (propFloor >= propTotalFloors * 0.66) floorScore = WEIGHTS.floor;
        else { floorScore = WEIGHTS.floor * 0.3; differences.push({ label: 'طبقه', detail: 'طبقه پایین‌تر از ترجیح' }); }
        break;
      case 'mid':
        if (propFloor >= propTotalFloors * 0.33 && propFloor <= propTotalFloors * 0.66) floorScore = WEIGHTS.floor;
        else floorScore = WEIGHTS.floor * 0.5;
        break;
      case 'low':
        if (propFloor <= propTotalFloors * 0.33) floorScore = WEIGHTS.floor;
        else { floorScore = WEIGHTS.floor * 0.3; differences.push({ label: 'طبقه', detail: 'طبقه بالاتر از ترجیح' }); }
        break;
      case 'ground':
        if (propFloor === 0 || propFloor === 1) floorScore = WEIGHTS.floor;
        else { floorScore = WEIGHTS.floor * 0.2; differences.push({ label: 'طبقه', detail: 'همکف نبود' }); }
        break;
      case 'any':
        floorScore = WEIGHTS.floor;
        break;
      default:
        floorScore = WEIGHTS.floor * 0.5;
    }
  } else {
    floorScore = WEIGHTS.floor * 0.5;
  }
  factors.push({ label: 'طبقه', matched: floorScore >= WEIGHTS.floor * 0.8 });
  score += floorScore;
  earned += floorScore;

  // --- Features ---
  total += WEIGHTS.features;
  let featureScore = 0;
  const featureKeys = ['parking', 'storage', 'elevator', 'balcony', 'yard', 'garden', 'pool', 'security', 'fireplace', 'fountain', 'jacuzzi', 'gazebo', 'bbq', 'sauna', 'caretaker', 'mezzanine', 'electric_shutter', 'signage', 'restroom', 'walled', 'water_well', 'office_space', 'ceiling_crane', 'water', 'electricity', 'gas'];
  const requestedFeatures = featureKeys.filter((k) => bool(tp[k]));
  const propFeatureMap: Record<string, boolean> = {
    parking: property.parking, storage: property.storage, elevator: property.elevator,
    balcony: property.balcony, yard: property.yard, garden: property.garden,
    pool: property.pool, security: property.security,
  };

  if (requestedFeatures.length > 0) {
    let matched = 0;
    const missing: string[] = [];
    const featureLabels: Record<string, string> = {
      parking: 'پارکینگ', storage: 'انباری', elevator: 'آسانسور', balcony: 'بالکن',
      yard: 'حیاط', garden: 'باغ', pool: 'استخر', security: 'امنیت',
      fireplace: 'آتشکده', fountain: 'آبنما', jacuzzi: 'جکوزی', gazebo: 'آلاچیق',
      bbq: 'باربیکیو', sauna: 'سونا', caretaker: 'سرایداری',
      mezzanine: 'بالکن تجاری', electric_shutter: 'کرکره برقی', signage: 'تابلوخور',
      restroom: 'سرویس بهداشتی', walled: 'چهاردیواری', water_well: 'چاه آب',
      office_space: 'فضای اداری', ceiling_crane: 'جرثقیل سقفی',
      water: 'آب', electricity: 'برق', gas: 'گاز',
    };
    for (const k of requestedFeatures) {
      if (propFeatureMap[k]) matched++;
      else missing.push(featureLabels[k] ?? k);
    }
    const ratio = matched / requestedFeatures.length;
    featureScore = WEIGHTS.features * ratio;
    factors.push({ label: 'امکانات', matched: ratio >= 0.8 });
    if (missing.length) differences.push({ label: 'امکانات', detail: `نقص: ${missing.join('، ')}` });
  } else {
    factors.push({ label: 'امکانات', matched: true });
    featureScore = WEIGHTS.features * 0.5;
  }
  score += featureScore;
  earned += featureScore;

  // --- Additional specific fields (facing, frontage, structure_type, commercial_location) ---
  const extraChecks: { key: string; label: string; propVal: string | undefined }[] = [
    { key: 'facing', label: 'جهت', propVal: undefined },
    { key: 'commercial_location', label: 'موقعیت تجاری', propVal: undefined },
    { key: 'structure_type', label: 'نوع سازه', propVal: undefined },
  ];
  for (const check of extraChecks) {
    const custVal = tp[check.key] as string | undefined;
    if (custVal && custVal !== 'any' && check.propVal && check.propVal !== 'any') {
      if (custVal !== check.propVal) {
        differences.push({ label: check.label, detail: `مشتری: ${custVal}، فایل: ${check.propVal}` });
      }
    }
  }

  const frontagePref = num(tp.frontage);
  if (frontagePref != null && frontagePref > 0) {
    // Frontage is a minimum requirement; property data may not have it, so skip if unknown
  }

  const finalScore = total > 0 ? Math.round(Math.min((earned / total) * 100, 100)) : 0;

  return {
    score: finalScore,
    factors,
    differences,
  };
}

// Priority engine for Command Center
export interface PriorityItem {
  id: string;
  type: 'overdue_followup' | 'hot_customer_match' | 'no_recent_contact' | 'owner_no_followup' | 'new_property_match' | 'today_followup';
  priority: number;
  title: string;
  description: string;
  action: string;
  entityId: string;
  entityType: string;
}

export function getPriorityLabel(type: PriorityItem['type']): string {
  const labels: Record<string, string> = {
    overdue_followup: 'پیگیری عقب‌افتاده',
    hot_customer_match: 'مشتری داغ با فایل تطبیق عالی',
    no_recent_contact: 'مشتری بدون تماس اخیر',
    owner_no_followup: 'مالک بدون پیگیری',
    new_property_match: 'فایل تازه با مشتری مناسب',
    today_followup: 'پیگیری‌های امروز',
  };
  return labels[type] ?? type;
}
