const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const DISH_ICONS = {
  pan: `<svg ${SVG_ATTRS}><circle cx="10.5" cy="12" r="6.5"/><path d="M17 9.5 21 7.5"/><path d="M8 10.5c.6-.8 1.6-1.2 2.5-1"/></svg>`,
  pot: `<svg ${SVG_ATTRS}><rect x="4.5" y="10" width="15" height="9" rx="1.5"/><path d="M3 10h18"/><path d="M7 10V7.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V10"/><path d="M2.5 13h1.5"/><path d="M20 13h1.5"/><path d="M9.5 4c0 .8.7 1 .7 1.8s-.7 1-.7 1.8"/><path d="M13.5 4c0 .8.7 1 .7 1.8s-.7 1-.7 1.8"/></svg>`,
  bowl: `<svg ${SVG_ATTRS}><path d="M3.5 11.5h17a7.5 6 0 0 1-8.5 6 7.5 6 0 0 1-8.5-6Z"/><path d="M10 5c0 .7.6.9.6 1.6S10 8.2 10 8.9"/><path d="M14 5c0 .7.6.9.6 1.6S14 8.2 14 8.9"/></svg>`,
  utensils: `<svg ${SVG_ATTRS}><path d="M7 3v6a1.5 1.5 0 0 0 3 0V3"/><path d="M8.5 9V21"/><path d="M17 3c-1.5 0-2.5 1.8-2.5 4s.7 3.5 1.5 4v10"/></svg>`,
};

export const ICON_KEYS = ['pan', 'pot', 'bowl', 'utensils'];

export const UI_ICONS = {
  search: `<svg ${SVG_ATTRS}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>`,
  plus: `<svg ${SVG_ATTRS}><path d="M12 5v14M5 12h14"/></svg>`,
  back: `<svg ${SVG_ATTRS}><path d="M15 5 8 12l7 7"/></svg>`,
  edit: `<svg ${SVG_ATTRS}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5.5 16.5Z"/><path d="M13.5 6.5 17.5 10.5"/></svg>`,
  share: `<svg ${SVG_ATTRS}><circle cx="18" cy="5" r="2.3"/><circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="19" r="2.3"/><path d="M8.1 10.7 15.9 6.3M8.1 13.3l7.8 4.4"/></svg>`,
  trash: `<svg ${SVG_ATTRS}><path d="M5 7h14"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6.5 7 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/></svg>`,
  close: `<svg ${SVG_ATTRS}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  camera: `<svg ${SVG_ATTRS}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.3"/></svg>`,
  chevronDown: `<svg ${SVG_ATTRS}><path d="m6 9 6 6 6-6"/></svg>`,
  folder: `<svg ${SVG_ATTRS}><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H9l2 2h7.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z"/></svg>`,
  link: `<svg ${SVG_ATTRS}><path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5l1.5-1.5a3 3 0 0 1 4.2 4.2L15 12"/><path d="M13 16.5 11.5 18a3 3 0 0 1-4.2-4.2L9 12"/></svg>`,
  settings: `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6 6.2 6.2"/></svg>`,
  check: `<svg ${SVG_ATTRS}><path d="M5 13l4.5 4.5L19 8"/></svg>`,
  sort: `<svg ${SVG_ATTRS}><path d="M7 5v14M7 5 4 8M7 5l3 3"/><path d="M17 19V5M17 19l3-3M17 19l-3-3"/></svg>`,
  sparkle: `<svg ${SVG_ATTRS}><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"/></svg>`,
  photo: `<svg ${SVG_ATTRS}><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10.5" r="1.7"/><path d="m5 17 4.5-4.5 3 3 3-4L20 17"/></svg>`,
};

export function iconMarkup(name) {
  return DISH_ICONS[name] || UI_ICONS[name] || '';
}
