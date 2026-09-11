// Field type definitions for property-type-specific customer preferences
// Each property type defines a set of sections, each with fields.
// Fields differ by role: buyers/applicants get ranges & preferences;
// owners/sellers/builders get exact values describing their property.

import { POWER_OPTIONS, GAS_OPTIONS, POWER_LABELS, GAS_LABELS } from './shopUtils';

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'checkbox-group' | 'location';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  ltr?: boolean;
}

export interface FieldSection {
  title: string;
  fields: FieldDef[];
}

function isOwnerRole(role: string): boolean {
  return role === 'owner' || role === 'seller' || role === 'builder';
}

// ---- Location section (shared) ----
const locationSection: FieldSection = {
  title: 'موقعیت',
  fields: [
    { key: 'county_id', label: 'شهرستان', type: 'location' },
    { key: 'city_id', label: 'شهر', type: 'location' },
    { key: 'neighborhood_id', label: 'محله', type: 'location' },
  ],
};

// ---- Financial section (role + transaction-type aware) ----
function financialSection(role: string, transactionType?: string): FieldSection {
  const isOwner = isOwnerRole(role);

  // Rent
  if (transactionType === 'rent') {
    if (isOwner) {
      return {
        title: 'مالی',
        fields: [
          { key: 'deposit', label: 'ودیعه (تومان)', type: 'text', placeholder: '100000000', ltr: true },
          { key: 'rent', label: 'اجاره ماهانه (تومان)', type: 'text', placeholder: '5000000', ltr: true },
        ],
      };
    }
    return {
      title: 'مالی',
      fields: [
        { key: 'deposit_min', label: 'حداقل ودیعه (تومان)', type: 'text', placeholder: '50000000', ltr: true },
        { key: 'deposit_max', label: 'حداکثر ودیعه (تومان)', type: 'text', placeholder: '200000000', ltr: true },
        { key: 'rent_min', label: 'حداقل اجاره ماهانه (تومان)', type: 'text', placeholder: '2000000', ltr: true },
        { key: 'rent_max', label: 'حداکثر اجاره ماهانه (تومان)', type: 'text', placeholder: '10000000', ltr: true },
      ],
    };
  }

  // Partnership
  if (transactionType === 'partnership') {
    if (role === 'builder') {
      return {
        title: 'مالی',
        fields: [
          { key: 'construction_budget_min', label: 'حداقل بودجه ساخت (تومان)', type: 'text', placeholder: '500000000', ltr: true },
          { key: 'construction_budget_max', label: 'حداکثر بودجه ساخت (تومان)', type: 'text', placeholder: '2000000000', ltr: true },
          { key: 'construction_share', label: 'سهم ساخت پیشنهادی (درصد)', type: 'text', placeholder: '50', ltr: true },
        ],
      };
    }
    return {
      title: 'مالی',
      fields: [
        { key: 'land_value', label: 'ارزش زمین (تومان)', type: 'text', placeholder: '2000000000', ltr: true },
        { key: 'expected_share', label: 'سهم مورد انتظار (درصد)', type: 'text', placeholder: '50', ltr: true },
      ],
    };
  }

  // Buy / Sell
  if (isOwner) {
    return {
      title: 'مالی',
      fields: [
        { key: 'asking_price', label: 'قیمت پیشنهادی (تومان)', type: 'text', placeholder: '2000000000', ltr: true },
      ],
    };
  }
  return {
    title: 'مالی',
    fields: [
      { key: 'budget_min', label: 'حداقل بودجه (تومان)', type: 'text', placeholder: '500000000', ltr: true },
      { key: 'budget_max', label: 'حداکثر بودجه (تومان)', type: 'text', placeholder: '2000000000', ltr: true },
    ],
  };
}

// ---- Options ----
const floorPreferenceOptions = [
  { value: 'high', label: 'طبقات بالا' },
  { value: 'mid', label: 'طبقات میانی' },
  { value: 'low', label: 'طبقات پایین' },
  { value: 'ground', label: 'همکف' },
  { value: 'any', label: 'فرقی ندارد' },
];

const facingOptions = [
  { value: 'north', label: 'شمال' },
  { value: 'south', label: 'جنوب' },
  { value: 'east', label: 'شرق' },
  { value: 'west', label: 'غرب' },
  { value: 'northeast', label: 'شمال شرقی' },
  { value: 'northwest', label: 'شمال غربی' },
  { value: 'southeast', label: 'جنوب شرقی' },
  { value: 'southwest', label: 'جنوب غربی' },
  { value: 'any', label: 'فرقی ندارد' },
];

const commercialLocationOptions = [
  { value: 'main_street', label: 'بر خیابان' },
  { value: 'corner', label: 'نبش' },
  { value: 'mall', label: 'داخل پاساژ/مجتمع' },
  { value: 'bazaar', label: 'بازار/راسته' },
  { value: 'any', label: 'فرقی ندارد' },
];

const structureTypeOptions = [
  { value: 'truss', label: 'خرپا' },
  { value: 'standard', label: 'استاندارد' },
  { value: 'any', label: 'فرقی ندارد' },
];

// ---- Feature toggles (role-aware labels) ----
// Owner sees "دارد؟" (does it have?), buyer sees "می‌خواهد؟" (do you want?)
function feat(key: string, noun: string, role: string): FieldDef {
  const suffix = isOwnerRole(role) ? 'دارد؟' : 'می‌خواهد؟';
  return { key, label: `${noun} ${suffix}`, type: 'checkbox' };
}

// برق ۳‌فاز (به آمپر) و گاز تجاری (به سایز متر) — مقدار اندازه‌شده، نه بله/خیر
function powerGasFields(role: string): FieldDef[] {
  const isOwner = isOwnerRole(role);
  return [
    { key: 'required_power', label: isOwner ? 'برق ملک' : 'برق ۳‌فاز (حداقل)', type: 'select', options: POWER_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    { key: 'required_gas', label: isOwner ? 'گاز ملک' : 'گاز تجاری (حداقل)', type: 'select', options: GAS_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  ];
}

function featuresApartment(role: string): FieldDef[] {
  return [
    feat('parking', 'پارکینگ', role),
    feat('storage', 'انباری', role),
    feat('elevator', 'آسانسور', role),
  ];
}

function featuresHouseVilla(role: string): FieldDef[] {
  return [
    feat('yard', 'حیاط', role),
    feat('garden', 'باغ یا فضای سبز', role),
    feat('parking', 'پارکینگ', role),
    feat('pool', 'استخر ۴ فصل', role),
    feat('fireplace', 'آتشکده', role),
    feat('fountain', 'آبنما', role),
    feat('jacuzzi', 'جکوزی', role),
    feat('gazebo', 'آلاچیق', role),
    feat('bbq', 'باربیکیو', role),
    feat('sauna', 'سونا', role),
    feat('caretaker', 'سرایداری', role),
  ];
}

function featuresPenthouse(role: string): FieldDef[] {
  return [
    feat('parking', 'پارکینگ', role),
    feat('storage', 'انباری', role),
    feat('elevator', 'آسانسور', role),
  ];
}

function featuresTower(role: string): FieldDef[] {
  return [
    feat('parking', 'پارکینگ', role),
    feat('storage', 'انباری', role),
    feat('elevator', 'آسانسور', role),
  ];
}

function featuresSuite(role: string): FieldDef[] {
  return featuresTower(role);
}

function featuresOldHouse(role: string): FieldDef[] {
  return [
    feat('water', 'آب', role),
  ];
}

function featuresResidentialLand(): FieldDef[] {
  return [];
}

function featuresShop(role: string): FieldDef[] {
  return [
    feat('mezzanine', 'بالکن یا نیمه طبقه', role),
    feat('electric_shutter', 'کرکره برقی', role),
    feat('signage', 'تابلوخور', role),
    feat('restroom', 'سرویس بهداشتی', role),
    ...powerGasFields(role),
  ];
}

function featuresMallBooth(role: string): FieldDef[] {
  return [
    feat('parking', 'پارکینگ', role),
  ];
}

function featuresCommercialBasement(role: string): FieldDef[] {
  return [
    feat('signage', 'تابلوخور', role),
    feat('restroom', 'سرویس بهداشتی', role),
  ];
}

function featuresCommercialLand(): FieldDef[] {
  return [];
}

function featuresGarden(role: string): FieldDef[] {
  return [
    feat('walled', 'چهاردیواری', role),
  ];
}

function featuresAgriculturalLand(role: string): FieldDef[] {
  return [
    feat('water_well', 'چاه آب', role),
  ];
}

function featuresOfficeApartment(role: string): FieldDef[] {
  return [
    feat('parking', 'پارکینگ', role),
  ];
}

function featuresFactory(role: string): FieldDef[] {
  return [
    feat('office_space', 'اداری', role),
    feat('security', 'نگهبانی', role),
    feat('ceiling_crane', 'جرثقیل سقفی', role),
    feat('water', 'آب', role),
    ...powerGasFields(role),
  ];
}

// ---- Specs section builders (role-aware: ranges for buyers, exact for owners) ----
function specsApartment(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '80', ltr: true },
          { key: 'rooms', label: 'تعداد اتاق', type: 'text', placeholder: '2', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '60', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '120', ltr: true },
          { key: 'min_rooms', label: 'حداقل اتاق', type: 'text', placeholder: '2', ltr: true },
        ],
  };
}

function specsHouseVilla(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'rooms', label: 'تعداد اتاق', type: 'text', placeholder: '3', ltr: true },
          { key: 'land_area', label: 'متراژ زمین', type: 'text', placeholder: '200', ltr: true },
          { key: 'building_area', label: 'زیربنا', type: 'text', placeholder: '150', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '100', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '300', ltr: true },
          { key: 'min_rooms', label: 'حداقل اتاق', type: 'text', placeholder: '3', ltr: true },
          { key: 'land_area', label: 'حداقل متراژ زمین', type: 'text', placeholder: '200', ltr: true },
          { key: 'building_area', label: 'حداقل زیربنا', type: 'text', placeholder: '150', ltr: true },
        ],
  };
}

function specsPenthouse(role: string): FieldSection {
  return specsHouseVilla(role);
}

function specsTower(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '120', ltr: true },
          { key: 'rooms', label: 'تعداد اتاق', type: 'text', placeholder: '2', ltr: true },
          { key: 'floor', label: 'طبقه', type: 'text', placeholder: '5', ltr: true },
          { key: 'total_floors', label: 'تعداد کل طبقات', type: 'text', placeholder: '12', ltr: true },
          { key: 'units_per_floor', label: 'تعداد واحد در هر طبقه', type: 'text', placeholder: '4', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '80', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'min_rooms', label: 'حداقل اتاق', type: 'text', placeholder: '2', ltr: true },
          { key: 'total_floors', label: 'تعداد کل طبقات', type: 'text', placeholder: '12', ltr: true },
          { key: 'units_per_floor', label: 'تعداد واحد در هر طبقه', type: 'text', placeholder: '4', ltr: true },
        ],
  };
}

function specsSuite(role: string): FieldSection {
  return specsTower(role);
}

function specsOldHouse(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'frontage', label: 'بر/دهنه', type: 'text', placeholder: '10', ltr: true },
          { key: 'facing', label: 'جهت ملک', type: 'select', options: facingOptions },
          { key: 'has_commercial', label: 'تجاری دارد؟', type: 'checkbox' },
          { key: 'max_build_floors', label: 'قابلیت ساخت تا چند طبقه', type: 'text', placeholder: '4', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '100', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '300', ltr: true },
          { key: 'frontage', label: 'حداقل بر/دهنه', type: 'text', placeholder: '10', ltr: true },
          { key: 'facing', label: 'جهت مورد نظر', type: 'select', options: facingOptions },
          { key: 'has_commercial', label: 'تجاری می‌خواهد؟', type: 'checkbox' },
          { key: 'max_build_floors', label: 'حداقل قابلیت ساخت (طبقه)', type: 'text', placeholder: '4', ltr: true },
        ],
  };
}

function specsResidentialLand(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '300', ltr: true },
          { key: 'frontage', label: 'بر/دهنه', type: 'text', placeholder: '10', ltr: true },
          { key: 'facing', label: 'جهت ملک', type: 'select', options: facingOptions },
          { key: 'needs_permit', label: 'جواز ساخت دارد؟', type: 'checkbox' },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '500', ltr: true },
          { key: 'frontage', label: 'حداقل بر/دهنه', type: 'text', placeholder: '10', ltr: true },
          { key: 'facing', label: 'جهت مورد نظر', type: 'select', options: facingOptions },
          { key: 'needs_permit', label: 'جواز ساخت می‌خواهد؟', type: 'checkbox' },
        ],
  };
}

function specsShop(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '50', ltr: true },
          { key: 'frontage', label: 'بر/دهنه', type: 'text', placeholder: '5', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '30', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '100', ltr: true },
          { key: 'frontage', label: 'حداقل بر/دهنه', type: 'text', placeholder: '5', ltr: true },
        ],
  };
}

function specsMallBooth(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '20', ltr: true },
          { key: 'floor', label: 'طبقه', type: 'text', placeholder: '1', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '10', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '30', ltr: true },
          { key: 'floor', label: 'طبقه مورد نظر', type: 'text', placeholder: '1', ltr: true },
        ],
  };
}

function specsCommercialBasement(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '50', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '30', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '100', ltr: true },
        ],
  };
}

function specsCommercialLand(role: string): FieldSection {
  return specsResidentialLand(role);
}

function specsGarden(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '500', ltr: true },
          { key: 'water_quota', label: 'سهمیه آب', type: 'text', placeholder: 'مثلا: ۱ ساعت در روز' },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'water_quota', label: 'سهمیه آب مورد نیاز', type: 'text', placeholder: 'مثلا: ۱ ساعت در روز' },
        ],
  };
}

function specsAgriculturalLand(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '1000', ltr: true },
          { key: 'frontage', label: 'بر/دهنه', type: 'text', placeholder: '20', ltr: true },
          { key: 'facing', label: 'جهت ملک', type: 'select', options: facingOptions },
          { key: 'needs_permit', label: 'جواز ساخت دارد؟', type: 'checkbox' },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '500', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '2000', ltr: true },
          { key: 'frontage', label: 'حداقل بر/دهنه', type: 'text', placeholder: '20', ltr: true },
          { key: 'facing', label: 'جهت مورد نظر', type: 'select', options: facingOptions },
          { key: 'needs_permit', label: 'جواز ساخت می‌خواهد؟', type: 'checkbox' },
        ],
  };
}

function specsOfficeApartment(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'area', label: 'متراژ', type: 'text', placeholder: '100', ltr: true },
          { key: 'rooms', label: 'تعداد اتاق', type: 'text', placeholder: '1', ltr: true },
        ]
      : [
          { key: 'min_area', label: 'حداقل متراژ', type: 'text', placeholder: '50', ltr: true },
          { key: 'max_area', label: 'حداکثر متراژ', type: 'text', placeholder: '200', ltr: true },
          { key: 'min_rooms', label: 'حداقل اتاق', type: 'text', placeholder: '1', ltr: true },
        ],
  };
}

function specsFactory(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'مشخصات ملک',
    fields: isOwner
      ? [
          { key: 'land_area', label: 'متراژ زمین', type: 'text', placeholder: '1000', ltr: true },
          { key: 'hall_area', label: 'متراژ سالن', type: 'text', placeholder: '500', ltr: true },
          { key: 'road_width', label: 'عرض گذر', type: 'text', placeholder: '12', ltr: true },
          { key: 'structure_type', label: 'نوع سازه', type: 'select', options: structureTypeOptions },
        ]
      : [
          { key: 'min_land_area', label: 'حداقل متراژ زمین', type: 'text', placeholder: '500', ltr: true },
          { key: 'max_land_area', label: 'حداکثر متراژ زمین', type: 'text', placeholder: '5000', ltr: true },
          { key: 'min_hall_area', label: 'حداقل متراژ سالن', type: 'text', placeholder: '300', ltr: true },
          { key: 'road_width', label: 'حداقل عرض گذر', type: 'text', placeholder: '12', ltr: true },
          { key: 'structure_type', label: 'نوع سازه مورد نظر', type: 'select', options: structureTypeOptions },
        ],
  };
}

// ---- Floor preference section (role-aware) ----
function floorPreferenceSection(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  if (isOwner) {
    return {
      title: 'طبقه',
      fields: [
        { key: 'floor', label: 'طبقه ملک', type: 'text', placeholder: '5', ltr: true },
      ],
    };
  }
  return {
    title: 'ترجیح طبقه',
    fields: [
      { key: 'floor_preference', label: 'ترجیح طبقه', type: 'select', options: floorPreferenceOptions },
    ],
  };
}

// ---- Commercial location section for shops ----
function commercialLocationSection(role: string): FieldSection {
  const isOwner = isOwnerRole(role);
  return {
    title: 'موقعیت تجاری',
    fields: [
      { key: 'commercial_location', label: isOwner ? 'موقعیت ملک' : 'موقعیت مورد نظر', type: 'select', options: commercialLocationOptions },
    ],
  };
}

// ---- Main field configuration map ----
export function getFieldSections(
  propertyType: string,
  role: string,
  transactionType?: string
): FieldSection[] {
  const finSection = financialSection(role, transactionType);
  switch (propertyType) {
    // ---- Residential ----
    case 'apartment':
      return [locationSection, finSection, specsApartment(role), floorPreferenceSection(role), { title: 'امکانات', fields: featuresApartment(role) }];

    case 'house':
      return [locationSection, finSection, specsHouseVilla(role), { title: 'امکانات', fields: featuresHouseVilla(role) }];

    case 'villa':
      return [locationSection, finSection, specsHouseVilla(role), { title: 'امکانات', fields: featuresHouseVilla(role) }];

    case 'penthouse':
      return [locationSection, finSection, specsPenthouse(role), { title: 'امکانات', fields: featuresPenthouse(role) }];

    case 'tower':
      return [locationSection, finSection, specsTower(role), { title: 'امکانات', fields: featuresTower(role) }];

    case 'suite':
      return [locationSection, finSection, specsSuite(role), { title: 'امکانات', fields: featuresSuite(role) }];

    case 'old_house':
      return [locationSection, finSection, specsOldHouse(role), { title: 'امکانات', fields: featuresOldHouse(role) }];

    case 'residential_estate':
      return [locationSection, finSection, specsApartment(role), { title: 'امکانات', fields: featuresApartment(role) }];

    case 'residential_land':
      return [locationSection, finSection, specsResidentialLand(role)];

    // ---- Commercial ----
    case 'shop':
      return [locationSection, finSection, commercialLocationSection(role), specsShop(role), { title: 'امکانات', fields: featuresShop(role) }];

    case 'mall_booth':
      return [locationSection, finSection, specsMallBooth(role), { title: 'امکانات', fields: featuresMallBooth(role) }];

    case 'commercial_basement':
      return [locationSection, finSection, specsCommercialBasement(role), { title: 'امکانات', fields: featuresCommercialBasement(role) }];

    case 'commercial_land':
      return [locationSection, finSection, specsCommercialLand(role)];

    // ---- Agricultural ----
    case 'garden':
      return [locationSection, finSection, specsGarden(role), { title: 'امکانات', fields: featuresGarden(role) }];

    case 'agricultural_land':
      return [locationSection, finSection, specsAgriculturalLand(role), { title: 'امکانات', fields: featuresAgriculturalLand(role) }];

    // ---- Office ----
    case 'office_apartment':
      return [locationSection, finSection, specsOfficeApartment(role), floorPreferenceSection(role), { title: 'امکانات', fields: featuresOfficeApartment(role) }];

    // ---- Industrial ----
    case 'factory':
      return [locationSection, finSection, specsFactory(role), floorPreferenceSection(role), { title: 'امکانات', fields: featuresFactory(role) }];

    case 'workshop':
      return [locationSection, finSection, specsFactory(role), { title: 'امکانات', fields: featuresFactory(role) }];

    case 'industrial_unit':
      return [locationSection, finSection, specsFactory(role), { title: 'امکانات', fields: featuresFactory(role) }];

    case 'warehouse':
      return [locationSection, finSection, specsFactory(role), { title: 'امکانات', fields: featuresFactory(role) }];

    case 'garage':
      return [locationSection, finSection, specsFactory(role), { title: 'امکانات', fields: featuresFactory(role) }];

    case 'industrial_land':
      return [locationSection, finSection, specsResidentialLand(role)];

    default:
      return [locationSection, finSection];
  }
}

// ---- Labels for displaying preference values ----
const labelMaps: Record<string, Record<string, string>> = {
  floor_preference: Object.fromEntries(floorPreferenceOptions.map((o) => [o.value, o.label])),
  facing: Object.fromEntries(facingOptions.map((o) => [o.value, o.label])),
  commercial_location: Object.fromEntries(commercialLocationOptions.map((o) => [o.value, o.label])),
  structure_type: Object.fromEntries(structureTypeOptions.map((o) => [o.value, o.label])),
  required_power: POWER_LABELS,
  required_gas: GAS_LABELS,
};

export function getFieldLabel(fieldKey: string, value: string): string {
  return labelMaps[fieldKey]?.[value] ?? value;
}

// ---- Get all field keys for a property type (for saving/loading) ----
export function getAllFieldKeys(propertyType: string, role: string, transactionType?: string): string[] {
  const sections = getFieldSections(propertyType, role, transactionType);
  const keys: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'location') continue;
      keys.push(field.key);
    }
  }
  return keys;
}
