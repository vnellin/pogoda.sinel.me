// Маппинг кодов погоды WMO → эмоджи + русское название.
// https://open-meteo.com/en/docs (раздел Weathercode WMO)
const TABLE = {
  0: { emoji: "☀️", label: "Ясно", tone: "sunny" },
  1: { emoji: "🌤️", label: "В основном ясно", tone: "sunny" },
  2: { emoji: "⛅", label: "Переменная облачность", tone: "cloudy" },
  3: { emoji: "☁️", label: "Пасмурно", tone: "cloudy" },
  45: { emoji: "🌫️", label: "Туман", tone: "fog" },
  48: { emoji: "🌫️", label: "Изморозь", tone: "fog" },
  51: { emoji: "🌦️", label: "Морось слабая", tone: "rain" },
  53: { emoji: "🌦️", label: "Морось умеренная", tone: "rain" },
  55: { emoji: "🌦️", label: "Морось плотная", tone: "rain" },
  56: { emoji: "🌧️", label: "Ледяная морось", tone: "rain" },
  57: { emoji: "🌧️", label: "Ледяная морось плотная", tone: "rain" },
  61: { emoji: "🌧️", label: "Дождь слабый", tone: "rain" },
  63: { emoji: "🌧️", label: "Дождь умеренный", tone: "rain" },
  65: { emoji: "🌧️", label: "Дождь сильный", tone: "rain" },
  66: { emoji: "🌧️", label: "Ледяной дождь", tone: "rain" },
  67: { emoji: "🌧️", label: "Ледяной дождь сильный", tone: "rain" },
  71: { emoji: "🌨️", label: "Снег слабый", tone: "snow" },
  73: { emoji: "🌨️", label: "Снег умеренный", tone: "snow" },
  75: { emoji: "🌨️", label: "Снег сильный", tone: "snow" },
  77: { emoji: "🌨️", label: "Снежная крупа", tone: "snow" },
  80: { emoji: "🌧️", label: "Ливень слабый", tone: "rain" },
  81: { emoji: "🌧️", label: "Ливень умеренный", tone: "rain" },
  82: { emoji: "🌧️", label: "Ливень сильный", tone: "rain" },
  85: { emoji: "🌨️", label: "Снегопад слабый", tone: "snow" },
  86: { emoji: "🌨️", label: "Снегопад сильный", tone: "snow" },
  95: { emoji: "⛈️", label: "Гроза", tone: "storm" },
  96: { emoji: "⛈️", label: "Гроза с градом", tone: "storm" },
  99: { emoji: "⛈️", label: "Гроза с сильным градом", tone: "storm" },
};

export function weatherInfo(code) {
  return TABLE[code] ?? { emoji: "❓", label: "—", tone: "cloudy" };
}

// Доминирующий код за группу часов (берём моду; при равенстве — самый «плохой»).
export function dominantCode(codes) {
  if (codes.length === 0) return null;
  const counts = new Map();
  for (const c of codes) {
    if (c == null) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestCode = null;
  let bestCount = -1;
  for (const [code, count] of counts) {
    if (count > bestCount || (count === bestCount && code > bestCode)) {
      bestCount = count;
      bestCode = code;
    }
  }
  return bestCode;
}
