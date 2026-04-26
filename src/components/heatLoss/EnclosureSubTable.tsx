/**
 * Enclosure sub-table shown inside expanded room row.
 * Lists all enclosures for a room with add/delete functionality.
 * Indented 16px left per UI-SPEC.
 */

import { useEnclosureStore } from '../../store/enclosureStore'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_ZONE_R } from '../../engine/heatLoss'
import { EnclosureRow } from './EnclosureRow'
import { ColumnHint } from '../ColumnHint'

interface EnclosureSubTableProps {
  roomId: string
  deltaT: number | null
  isCorner: boolean
  roomArea: number
}

export function EnclosureSubTable({ roomId, deltaT, isCorner, roomArea }: EnclosureSubTableProps) {
  const enclosures = useEnclosureStore(
    useShallow(s =>
      s.enclosureOrder
        .filter(id => s.enclosures[id]?.roomId === roomId)
        .map(id => s.enclosures[id])
        .filter((enc): enc is NonNullable<typeof enc> => enc != null)
    )
  )

  const handleAddEnclosure = () => {
    useEnclosureStore.getState().addEnclosure({
      roomId,
      type: 'wall-ext',
      orientation: '\u0421',
      area: 0,
      kValue: 0,
      nCoeff: 1.0,
      nOverridden: false,
      adjacentRoomName: null,
      tAdjacent: null,
      perimeterOverride: null,
      zoneR: [...DEFAULT_ZONE_R],
      parentEnclosureId: null,
      constructionId: null,
    })
  }

  return (
    <div className="ml-4 my-2 bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
      {enclosures.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] align-bottom">
                <th className="px-2 py-1.5 min-w-[170px]">
                  <ColumnHint label="Тип" hint="Тип ограждающей конструкции — наружная стена, окно, дверь, перекрытие, пол по грунту, внутренняя стена и т.д." />
                </th>
                <th className="px-2 py-1.5 min-w-[56px]">
                  <ColumnHint label="Ориент." hint="Ориентация наружной поверхности по сторонам света (С, СВ, В, ЮВ, Ю, ЮЗ, З, СЗ). Влияет на поправку β_ор к теплопотерям." />
                </th>
                <th className="px-2 py-1.5 min-w-[76px]">
                  <ColumnHint label={`Площадь м${'\u00B2'}`} hint="Площадь ограждения в квадратных метрах. Для стен — брутто (без вычета окон/дверей): движок вычтет проёмы по привязке parent → child автоматически." />
                </th>
                <th className="px-2 py-1.5 min-w-[220px]">
                  <ColumnHint label={`K + конструкция`} hint="Коэффициент теплопередачи K = 1/R. Выбери готовую конструкцию из каталога — K подставится автоматически. Или введи K вручную. Индикатор под полем показывает, проходит ли конструкция норму СП 50.13330 для ГСОП твоего города." />
                </th>
                <th className="px-2 py-1.5 min-w-[64px]">
                  <ColumnHint label="n" hint="Коэффициент редукции разности температур по СП 50.13330. Для наружных конструкций n = 1.0, для пола над подвалом ~0.6, для внутренних стен ~0.5 и т.д. Нажми значение в ячейке, чтобы ввести вручную." />
                </th>
                <th className="px-2 py-1.5 min-w-[72px] text-right font-mono">
                  <ColumnHint label="Q, Вт" hint="Тепловой поток через ограждение в ваттах: Q = K · A · Δt · n · (1 + β_ор + β_угл). Щёлкни по значку, чтобы посмотреть развёрнутую формулу." />
                </th>
                <th className="px-2 py-1.5 w-8">{/* delete */}</th>
              </tr>
            </thead>
            <tbody>
              {enclosures.map(enc => (
                <EnclosureRow
                  key={enc.id}
                  enclosure={enc}
                  deltaT={deltaT}
                  isCorner={isCorner}
                  roomArea={roomArea}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Ограждения не добавлены. Нажмите {'\u00AB'}+ Добавить ограждение{'\u00BB'}
        </p>
      )}

      <div className="px-2 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={handleAddEnclosure}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          + Добавить ограждение
        </button>
      </div>
    </div>
  )
}
