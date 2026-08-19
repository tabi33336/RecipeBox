export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

export const MEAL_TYPE_LABELS = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
};

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatMonthLabel(year, month) {
  return `${year}年${month + 1}月`;
}

/** Returns 42 Date objects (6 weeks, Sun-start) covering the given month, including leading/trailing days from adjacent months. */
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export function groupEntriesByDate(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!map.has(entry.date)) map.set(entry.date, []);
    map.get(entry.date).push(entry);
  }
  for (const list of map.values()) {
    list.sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));
  }
  return map;
}
