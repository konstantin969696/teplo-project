/**
 * Expanded-row контент для EquipmentRow. Показывает:
 * 1) FormulaAudit LMTD (buildLMTDAuditString)
 * 2) FormulaAudit коррекции Q_ном → Q_факт (buildCorrectionAuditString)
 * 3) Для секционных — FormulaAudit расчёта числа секций (buildSectionsAuditString)
 * 4) Для панельных — список альтернативных типоразмеров через selectPanelSize
 * 5) <InsufficientWarning> когда qActual < qRequired (или qActual === null)
 *
 * Все тяжёлые вычисления уже сделаны в EquipmentRow и приходят в props —
 * здесь только визуализация.
 */

import type {
  ConnectionScheme,
  Equipment,
  InstallationPlace,
  PanelCatalogModel,
  PanelVariantResult,
  Room,
} from '../../types/project'
import { useCatalogStore } from '../../store/catalogStore'
import {
  buildCorrectionAuditString,
  buildLMTDAuditString,
  buildSectionsAuditString,
  CONNECTION_SCHEME_COEFF,
  INSTALLATION_COEFF,
  correctQNominal,
  selectPanelSize,
} from '../../engine/equipment'
import { FormulaAudit } from '../heatLoss/FormulaAudit'
import { InsufficientWarning } from './InsufficientWarning'
import { getEffectiveNExponent } from './equipment-help'

interface EquipmentDetailsProps {
  equipment: Equipment
  room: Room
  qRequired: number | null
  lmtd: number
  qActual: number | null
  sectionsCalc: number | null
  /** Per-system температуры подачи/обратки (D-27). */
  tSupply: number
  tReturn: number
}

export function EquipmentDetails({
  equipment,
  room,
  qRequired,
  lmtd,
  qActual,
  sectionsCalc,
  tSupply,
  tReturn,
}: EquipmentDetailsProps) {
  const model = useCatalogStore(s =>
    equipment.catalogModelId ? s.models[equipment.catalogModelId] ?? null : null
  )

  const nExp = getEffectiveNExponent(equipment, model)
  const kConn = CONNECTION_SCHEME_COEFF[equipment.connection]
  const kInst = INSTALLATION_COEFF[equipment.installation]

  // Эффективная Q_ном «на единицу» — секцию / вариант панели / вариант конвектора.
  const qNomEffective = computeQNomEffective(equipment, model)

  const isSectional =
    equipment.kind === 'bimetal' || equipment.kind === 'aluminum' || equipment.kind === 'cast-iron'

  const isInsufficient =
    qActual === null || qRequired === null || (qRequired > 0 && qActual < qRequired)

  const correctedPerUnit =
    qNomEffective > 0 && lmtd > 0
      ? correctQNominal(qNomEffective, nExp, lmtd, equipment.connection, equipment.installation)
      : null

  return (
    <div className="ml-4 mb-2 mt-1 p-3 space-y-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded">
      <FormulaAudit
        auditString={buildLMTDAuditString(tSupply, tReturn, room.tInside, lmtd)}
        label="LMTD — показать расчёт"
      />

      {correctedPerUnit !== null && (
        <FormulaAudit
          auditString={buildCorrectionAuditString(
            qNomEffective,
            nExp,
            lmtd,
            kConn,
            kInst,
            correctedPerUnit,
          )}
          label="Коррекция Q_ном → Q_факт — показать расчёт"
        />
      )}

      {isSectional && sectionsCalc !== null && correctedPerUnit !== null && qRequired !== null && (
        <FormulaAudit
          auditString={buildSectionsAuditString(
            qRequired,
            correctedPerUnit,
            sectionsCalc,
            equipment.sectionsOverride ?? Math.max(1, Math.ceil(sectionsCalc)),
          )}
          label="Расчёт секций — показать"
        />
      )}

      {equipment.kind === 'panel' && model && model.kind === 'panel' && qRequired !== null && lmtd > 0 && (
        <PanelAlternatives
          model={model}
          qRequired={qRequired}
          lmtd={lmtd}
          connection={equipment.connection}
          installation={equipment.installation}
        />
      )}

      {isInsufficient && qRequired !== null && qRequired > 0 && (
        <InsufficientWarning qRequired={qRequired} kind={equipment.kind} />
      )}
    </div>
  )
}

interface PanelAlternativesProps {
  model: PanelCatalogModel
  qRequired: number
  lmtd: number
  connection: ConnectionScheme
  installation: InstallationPlace
}

function PanelAlternatives({
  model,
  qRequired,
  lmtd,
  connection,
  installation,
}: PanelAlternativesProps) {
  const { chosen, alternatives } = selectPanelSize(qRequired, model, lmtd, connection, installation)
  const items: readonly PanelVariantResult[] = chosen ? [chosen, ...alternatives] : alternatives
  if (items.length === 0) return null

  return (
    <div className="text-xs">
      <div className="text-[var(--color-text-secondary)] mb-1">Альтернативные типоразмеры:</div>
      <ul className="space-y-0.5 font-mono">
        {items.map((v, i) => {
          const isChosen = chosen !== null && i === 0
          return (
            <li
              key={`${v.heightMm}-${v.lengthMm}`}
              className={
                isChosen
                  ? 'text-[var(--color-accent)] font-semibold'
                  : 'text-[var(--color-text-primary)]'
              }
            >
              {v.heightMm}×{v.lengthMm} мм → {v.qActual.toFixed(0)} Вт
              {isChosen && ' (выбрано)'}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function computeQNomEffective(
  equipment: Equipment,
  model: ReturnType<typeof useCatalogStore.getState>['models'][string] | null,
): number {
  if (equipment.manualQNominal !== null) return equipment.manualQNominal
  if (model === null) return 0
  if (model.kind === 'panel') {
    if (equipment.panelHeightMm === null || equipment.panelLengthMm === null) return 0
    const variant = model.variants.find(
      v => v.heightMm === equipment.panelHeightMm && v.lengthMm === equipment.panelLengthMm,
    )
    return variant?.qAt70 ?? 0
  }
  if (model.kind === 'underfloor-convector') {
    if (equipment.convectorLengthMm === null) return 0
    const variant = model.variants.find(v => v.lengthMm === equipment.convectorLengthMm)
    return variant?.qAt70 ?? 0
  }
  // Sectional
  return model.qPerSectionAt70
}
