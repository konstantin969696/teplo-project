import type { CityData } from '../types/project'

export type { CityData }

/**
 * Климатические данные по СП 131.13330.2025 «Строительная климатология».
 *
 * Источник: Таблица 5.1 (климатические параметры холодного периода года).
 * Парсинг выполнен автоматически из официального PDF 03.10.2025.
 *
 * Поля:
 *   tOutside     — расчётная температура наиболее холодной пятидневки
 *                  обеспеченностью 0,92 (tн.о.), °C — Таблица 5.1, гр.6.
 *   gsop         — ГСОП жилых помещений = (tвн − tот.ср) · zот.пер, где
 *                  период со среднесуточной t ≤ 8 °C, tвн = 20 °C —
 *                  Таблица 5.1, гр.12 и 13.
 *   humidityZone — зона влажности района строительства (А/Б/В) —
 *                  СП 131.13330 Приложение В (значения без изменений).
 *
 * Включены все 16 городов-миллионников РФ + региональные центры,
 * присутствующие в Таблице 5.1 редакции 2025. Города, отсутствующие в
 * новой редакции (Магнитогорск, Тольятти, Набережные Челны, Новокузнецк,
 * Нижневартовск, Горно-Алтайск, Петропавловск-Камчатский), исключены —
 * добавь их вручную через «+ Город» по ближайшей метеостанции.
 */
export const CITIES: readonly CityData[] = [
  { name: 'Абакан', tOutside: -36, gsop: 6028, humidityZone: 'А' },
  { name: 'Анадырь', tOutside: -38, gsop: 9083, humidityZone: 'Б' },
  { name: 'Архангельск', tOutside: -33, gsop: 5904, humidityZone: 'Б' },
  { name: 'Астрахань', tOutside: -19, gsop: 3268, humidityZone: 'В' },
  { name: 'Барнаул', tOutside: -34, gsop: 5697, humidityZone: 'А' },
  { name: 'Белгород', tOutside: -22, gsop: 3940, humidityZone: 'Б' },
  { name: 'Благовещенск', tOutside: -32, gsop: 6240, humidityZone: 'А' },
  { name: 'Брянск', tOutside: -22, gsop: 4214, humidityZone: 'Б' },
  { name: 'Великий Новгород', tOutside: -27, gsop: 4430, humidityZone: 'Б' },
  { name: 'Владивосток', tOutside: -22, gsop: 4660, humidityZone: 'Б' },
  { name: 'Владикавказ', tOutside: -15, gsop: 3118, humidityZone: 'Б' },
  { name: 'Владимир', tOutside: -28, gsop: 4694, humidityZone: 'Б' },
  { name: 'Волгоград', tOutside: -21, gsop: 3771, humidityZone: 'Б' },
  { name: 'Вологда', tOutside: -32, gsop: 5264, humidityZone: 'Б' },
  { name: 'Воронеж', tOutside: -23, gsop: 4092, humidityZone: 'Б' },
  { name: 'Грозный', tOutside: -17, gsop: 2914, humidityZone: 'Б' },
  { name: 'Екатеринбург', tOutside: -30, gsop: 5422, humidityZone: 'А' },
  { name: 'Иваново', tOutside: -28, gsop: 4851, humidityZone: 'Б' },
  { name: 'Ижевск', tOutside: -30, gsop: 5422, humidityZone: 'Б' },
  { name: 'Иркутск', tOutside: -33, gsop: 6233, humidityZone: 'А' },
  { name: 'Йошкар-Ола', tOutside: -30, gsop: 5127, humidityZone: 'Б' },
  { name: 'Казань', tOutside: -28, gsop: 4937, humidityZone: 'Б' },
  { name: 'Калининград', tOutside: -18, gsop: 3386, humidityZone: 'Б' },
  { name: 'Калуга', tOutside: -24, gsop: 4488, humidityZone: 'Б' },
  { name: 'Кемерово', tOutside: -37, gsop: 6142, humidityZone: 'А' },
  { name: 'Киров', tOutside: -31, gsop: 5366, humidityZone: 'Б' },
  { name: 'Кострома', tOutside: -29, gsop: 4942, humidityZone: 'Б' },
  { name: 'Краснодар', tOutside: -15, gsop: 2428, humidityZone: 'Б' },
  { name: 'Красноярск', tOutside: -37, gsop: 6003, humidityZone: 'А' },
  { name: 'Курган', tOutside: -33, gsop: 5643, humidityZone: 'А' },
  { name: 'Курск', tOutside: -22, gsop: 4164, humidityZone: 'Б' },
  { name: 'Липецк', tOutside: -25, gsop: 4384, humidityZone: 'Б' },
  { name: 'Магадан', tOutside: -27, gsop: 7452, humidityZone: 'Б' },
  { name: 'Махачкала', tOutside: -16, gsop: 2570, humidityZone: 'Б' },
  { name: 'Москва', tOutside: -23, gsop: 4383, humidityZone: 'Б' },
  { name: 'Мурманск', tOutside: -28, gsop: 6233, humidityZone: 'Б' },
  { name: 'Нальчик', tOutside: -17, gsop: 3040, humidityZone: 'Б' },
  { name: 'Нижний Новгород', tOutside: -26, gsop: 4756, humidityZone: 'Б' },
  { name: 'Нижний Тагил', tOutside: -33, gsop: 5888, humidityZone: 'А' },
  { name: 'Новосибирск', tOutside: -36, gsop: 6028, humidityZone: 'Б' },
  { name: 'Норильск', tOutside: -46, gsop: 9636, humidityZone: 'А' },
  { name: 'Омск', tOutside: -34, gsop: 5851, humidityZone: 'А' },
  { name: 'Орёл', tOutside: -20, gsop: 4251, humidityZone: 'Б' },
  { name: 'Оренбург', tOutside: -29, gsop: 4915, humidityZone: 'А' },
  { name: 'Пенза', tOutside: -26, gsop: 4649, humidityZone: 'Б' },
  { name: 'Пермь', tOutside: -32, gsop: 5525, humidityZone: 'Б' },
  { name: 'Петрозаводск', tOutside: -29, gsop: 5243, humidityZone: 'Б' },
  { name: 'Псков', tOutside: -24, gsop: 4264, humidityZone: 'Б' },
  { name: 'Ростов-на-Дону', tOutside: -18, gsop: 3231, humidityZone: 'Б' },
  { name: 'Рязань', tOutside: -24, gsop: 4520, humidityZone: 'Б' },
  { name: 'Самара', tOutside: -27, gsop: 4671, humidityZone: 'Б' },
  { name: 'Санкт-Петербург', tOutside: -23, gsop: 4326, humidityZone: 'Б' },
  { name: 'Саранск', tOutside: -27, gsop: 4808, humidityZone: 'Б' },
  { name: 'Саратов', tOutside: -23, gsop: 4394, humidityZone: 'Б' },
  { name: 'Севастополь', tOutside: -7, gsop: 1993, humidityZone: 'В' },
  { name: 'Симферополь', tOutside: -13, gsop: 2632, humidityZone: 'В' },
  { name: 'Смоленск', tOutside: -23, gsop: 4408, humidityZone: 'Б' },
  { name: 'Сочи', tOutside: -2, gsop: 1139, humidityZone: 'Б' },
  { name: 'Ставрополь', tOutside: -18, gsop: 3168, humidityZone: 'Б' },
  { name: 'Сургут', tOutside: -42, gsop: 7200, humidityZone: 'А' },
  { name: 'Сыктывкар', tOutside: -35, gsop: 5999, humidityZone: 'Б' },
  { name: 'Тамбов', tOutside: -25, gsop: 4400, humidityZone: 'Б' },
  { name: 'Тверь', tOutside: -26, gsop: 4618, humidityZone: 'Б' },
  { name: 'Томск', tOutside: -37, gsop: 6279, humidityZone: 'Б' },
  { name: 'Тула', tOutside: -24, gsop: 4462, humidityZone: 'Б' },
  { name: 'Тюмень', tOutside: -33, gsop: 5755, humidityZone: 'Б' },
  { name: 'Улан-Удэ', tOutside: -34, gsop: 6749, humidityZone: 'А' },
  { name: 'Ульяновск', tOutside: -29, gsop: 4884, humidityZone: 'Б' },
  { name: 'Уфа', tOutside: -31, gsop: 5232, humidityZone: 'Б' },
  { name: 'Хабаровск', tOutside: -29, gsop: 5867, humidityZone: 'Б' },
  { name: 'Ханты-Мансийск', tOutside: -40, gsop: 6913, humidityZone: 'А' },
  { name: 'Чебоксары', tOutside: -29, gsop: 4989, humidityZone: 'Б' },
  { name: 'Челябинск', tOutside: -31, gsop: 5476, humidityZone: 'А' },
  { name: 'Чита', tOutside: -36, gsop: 7214, humidityZone: 'А' },
  { name: 'Элиста', tOutside: -21, gsop: 3440, humidityZone: 'Б' },
  { name: 'Южно-Сахалинск', tOutside: -21, gsop: 5376, humidityZone: 'Б' },
  { name: 'Якутск', tOutside: -51, gsop: 9935, humidityZone: 'А' },
  { name: 'Ярославль', tOutside: -29, gsop: 4855, humidityZone: 'Б' },
] as const

/** Редакция СП, по которой заполнен справочник. Отображается в UI. */
export const CLIMATE_NORM_REF = 'СП 131.13330.2025' as const
