export interface CityData {
  readonly name: string
  readonly tOutside: number
  readonly gsop: number
  readonly humidityZone: 'А' | 'Б' | 'В'
}

export interface CustomCityData extends CityData {
  readonly id: string
  readonly isCustom: true
}

export interface Room {
  readonly id: string
  readonly number: number             // Номер помещения по плану (101, 201, А-5 → число). Не уникальный — инженер управляет сам.
  readonly name: string
  readonly floor: number
  readonly area: number
  readonly height: number
  // Phase 2: heat loss fields
  readonly isCorner: boolean
  readonly infiltrationMethod: 'rate' | 'gap'
  readonly nInfiltration: number | null  // кратность воздухообмена, null = не задано
  readonly gapArea: number | null     // м² площадь щелей, used when method='gap'
  readonly windSpeed: number | null   // м/с, used when method='gap'
  readonly lVentilation: number       // L_пр м³/ч, manual input, default 0
  readonly tInside: number            // °C расчётная температура помещения, default from global
}

export type EnclosureType =
  | 'wall-ext'      // Наружная стена
  | 'window'        // Окно
  | 'door-ext'      // Дверь (наружная)
  | 'ceiling'       // Перекрытие
  | 'roof'          // Покрытие (кровля)
  | 'floor-ground'  // Пол по грунту
  | 'wall-int'      // Внутренняя стена
  | 'ceiling-int'   // Внутреннее перекрытие

export type Orientation = 'С' | 'СВ' | 'СЗ' | 'В' | 'ЮВ' | 'Ю' | 'ЮЗ' | 'З'

export interface Enclosure {
  readonly id: string
  readonly roomId: string
  readonly type: EnclosureType
  readonly orientation: Orientation | null  // null for internal types
  readonly area: number                     // gross area; net = area - Σ children.area for walls
  // Optional dimensions: when both > 0, area is auto-computed (length × heightM).
  // User may still type into area directly; in that case length/heightM stay as last entered (or undefined).
  readonly length?: number
  readonly heightM?: number
  readonly kValue: number          // K Вт/(м2*C)
  readonly nCoeff: number          // reduction factor n
  readonly nOverridden: boolean    // true when user changed n manually
  readonly adjacentRoomName: string | null
  readonly tAdjacent: number | null        // C, for internal types
  readonly perimeterOverride: number | null  // null = auto for floor-ground
  readonly zoneR: readonly [number, number, number, number]  // R_ред for zones I-IV
  // Parent wall for windows/doors — the engine subtracts their area from the
  // wall's gross area before computing Q (avoids double-counting). null = no
  // parent (treated as independent enclosure, matching pre-parent-child behaviour).
  readonly parentEnclosureId: string | null
  // Linked construction from the construction catalog. null → K entered manually.
  // When set, kValue is derived from the catalog entry; user may still override manually.
  readonly constructionId: string | null
}

// --------------- Construction catalog (Phase 3.5) ---------------

/**
 * Reusable enclosure construction preset: a named «pie» with a precomputed K.
 * Scoped to a specific EnclosureType so the picker can filter by what fits.
 */
export interface CatalogConstruction {
  readonly id: string
  readonly name: string              // e.g. "Кирпич 510 + ЭППС 100 мм"
  readonly type: EnclosureType       // filter: for what kind of enclosure
  readonly kValue: number            // Вт/(м²·°C)
  readonly note: string | null       // short comment (composition, source, where applies)
  readonly category: string | null   // sub-group inside the type, e.g. "Кирпичные", "Газобетон"
  readonly isCustom: boolean
}

export interface ConstructionState {
  readonly userOverrides: Record<string, CatalogConstruction>
  readonly deletedSeedIds: readonly string[]
  readonly models: Record<string, CatalogConstruction>   // merged (seed − deleted + overrides)
  addConstruction: (c: Omit<CatalogConstruction, 'id' | 'isCustom'>) => string
  updateConstruction: (id: string, changes: Partial<Omit<CatalogConstruction, 'id' | 'isCustom'>>) => void
  deleteConstruction: (id: string) => void
}

export interface EnclosureState {
  readonly enclosures: Record<string, Enclosure>
  readonly enclosureOrder: readonly string[]
  addEnclosure: (enc: Omit<Enclosure, 'id'>) => void
  updateEnclosure: (id: string, changes: Partial<Omit<Enclosure, 'id'>>) => void
  deleteEnclosure: (id: string) => void
  deleteEnclosuresByRoom: (roomId: string) => void
  copyFloor: (sourceFloor: number, targetFloor: number) => void
}

export interface FloorZoneResult {
  readonly zoneIndex: 0 | 1 | 2 | 3
  readonly width: number
  readonly area: number
  readonly rValue: number
  readonly qWatts: number
}

export interface RoomHeatLossResult {
  readonly roomId: string
  readonly roomName: string
  readonly floor: number
  readonly area: number
  readonly qBasic: number       // Q_осн total for room
  readonly qInfiltration: number // Q_инф
  readonly qVentilation: number  // Q_вент
  readonly qTotal: number        // Q_итого
  readonly qSpecific: number     // Вт/м2
}

export interface ProjectData {
  readonly city: CityData | null
  readonly tInside: number
  readonly rooms: Record<string, Room>
  readonly roomOrder: readonly string[]
  readonly customCities: readonly CustomCityData[]

  /** v1.1 marker — bumped after persist.migrate, confirmed after clearLegacyV10Fields */
  readonly schemaVersion: '1.1'

  /**
   * @deprecated migrated to HeatingSystem in v1.1, cleared after migration via clearLegacyV10Fields.
   * Do not use in new code — read from useSystemStore(s => s.systems[systemId]).tSupply.
   */
  readonly tSupply?: number
  /** @deprecated см. tSupply */
  readonly tReturn?: number
  /** @deprecated см. tSupply */
  readonly tSupplyUfh?: number
  /** @deprecated см. tSupply */
  readonly tReturnUfh?: number
  /** @deprecated см. tSupply */
  readonly schemaType?: import('./hydraulics').SchemaType
  /** @deprecated см. tSupply */
  readonly pipeMaterialId?: string
  /** @deprecated см. tSupply */
  readonly coolantId?: string
}

export interface ProjectState extends ProjectData {
  readonly activeTab: number
  setCity: (city: CityData | null) => void
  setTInside: (t: number) => void
  setActiveTab: (tab: number) => void
  exportJSON: () => void
  importJSON: (data: unknown) => void
  resetProject: () => void
  addCustomCity: (city: Omit<CustomCityData, 'id' | 'isCustom'>) => void
  updateCustomCity: (id: string, city: Omit<CustomCityData, 'id' | 'isCustom'>) => void
  deleteCustomCity: (id: string) => void
  addRoom: (room: Omit<Room, 'id'>) => void
  updateRoom: (id: string, changes: Partial<Omit<Room, 'id'>>) => void
  deleteRoom: (id: string) => void
  /** Phase 04.1: removes 7 legacy v1.0 fields from state after runV11Migration completes. Called from App.tsx. */
  readonly clearLegacyV10Fields: () => void
}

export const PROJECT_VERSION = 1

// ============================================================
// Phase 3: Equipment Selection types
// ============================================================

export type EquipmentKind =
  | 'panel'
  | 'bimetal'
  | 'aluminum'
  | 'cast-iron'
  | 'underfloor-convector'

export type ConnectionScheme = 'side' | 'bottom' | 'diagonal'

export type InstallationPlace = 'open' | 'niche' | 'under-sill'

export type PanelType = '11' | '21' | '22' | '33'

export interface Equipment {
  readonly id: string
  readonly roomId: string
  readonly systemId: string           // D-10: Phase 04.1 — обязательная привязка к системе
  readonly kind: EquipmentKind
  readonly catalogModelId: string | null    // null = ручной ввод (D-02)
  readonly connection: ConnectionScheme
  readonly installation: InstallationPlace
  readonly panelType: PanelType | null
  readonly panelHeightMm: number | null
  readonly panelLengthMm: number | null
  readonly sectionsOverride: number | null  // null = auto = Math.ceil(calculated)
  readonly convectorLengthMm: number | null
  readonly manualQNominal: number | null    // Вт при ΔT=70 — D-02 ручной ввод
  readonly manualNExponent: number | null
}

export interface CatalogModelCommon {
  readonly id: string
  readonly manufacturer: string
  readonly series: string
  readonly kind: EquipmentKind
  readonly nExponent: number
  readonly isCustom: boolean
}

export interface SectionalCatalogModel extends CatalogModelCommon {
  readonly kind: 'bimetal' | 'aluminum' | 'cast-iron'
  readonly qPerSectionAt70: number
  readonly heightMm: number
  readonly sectionWidthMm: number
  readonly maxSections: number
}

export interface PanelCatalogModel extends CatalogModelCommon {
  readonly kind: 'panel'
  readonly panelType: PanelType
  readonly variants: readonly {
    readonly heightMm: number
    readonly lengthMm: number
    readonly qAt70: number
  }[]
}

export interface ConvectorCatalogModel extends CatalogModelCommon {
  readonly kind: 'underfloor-convector'
  readonly widthMm: number
  readonly depthMm: number
  readonly variants: readonly {
    readonly lengthMm: number
    readonly qAt70: number
  }[]
}

export type CatalogModel = SectionalCatalogModel | PanelCatalogModel | ConvectorCatalogModel

export interface EquipmentSelectionResult {
  readonly qRequired: number
  readonly qActual: number
  readonly reservePct: number       // (qActual - qRequired) / qRequired * 100; <0 = недобор
  readonly lmtd: number
  readonly insufficient: boolean    // true если ни один вариант не покрыл Q_required
}

export interface PanelVariantResult {
  readonly heightMm: number
  readonly lengthMm: number
  readonly qNominal: number
  readonly qActual: number
}

export interface EquipmentState {
  readonly equipment: Record<string, Equipment>
  readonly equipmentOrder: readonly string[]
  addEquipment: (eq: Omit<Equipment, 'id'>) => string
  updateEquipment: (id: string, changes: Partial<Omit<Equipment, 'id'>>) => void
  deleteEquipment: (id: string) => void
  deleteEquipmentByRoom: (roomId: string) => void
  /** Phase 04.1 cascade: removes all equipment belonging to a system (D-04). */
  deleteBySystemId: (systemId: string) => void
  /** Phase 04.1 migration: sets systemId on all equipment (D-25). */
  bulkSetSystemId: (systemId: string) => void
}

export interface CatalogState {
  readonly models: Record<string, CatalogModel>
  readonly userOverrides: Record<string, CatalogModel>
  readonly deletedSeedIds: readonly string[]
  addModel: (model: Omit<CatalogModel, 'id' | 'isCustom'>) => string
  updateModel: (id: string, changes: Partial<CatalogModel>) => void
  deleteModel: (id: string) => void
  resetToSeed: () => void
}
