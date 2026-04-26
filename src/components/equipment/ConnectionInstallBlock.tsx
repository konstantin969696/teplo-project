/**
 * ConnectionInstallBlock — two inline selects for connection scheme + installation place.
 * Feeds EQUIP-05 (k_подкл) and EQUIP-06 (k_устан) correction coefficients.
 * Click events on selects stop propagation (row toggle protection).
 */

import type { ConnectionScheme, InstallationPlace } from '../../types/project'
import { CONNECTION_LABELS, INPUT_CLASS, INSTALLATION_LABELS } from './equipment-help'

const CONNECTIONS: readonly ConnectionScheme[] = ['side', 'bottom', 'diagonal']
const INSTALLATIONS: readonly InstallationPlace[] = ['open', 'niche', 'under-sill']

interface ConnectionInstallBlockProps {
  connection: ConnectionScheme
  installation: InstallationPlace
  onChange: (changes: { connection?: ConnectionScheme; installation?: InstallationPlace }) => void
}

export function ConnectionInstallBlock({ connection, installation, onChange }: ConnectionInstallBlockProps) {
  return (
    <div className="flex gap-2">
      <select
        value={connection}
        onChange={e => onChange({ connection: e.target.value as ConnectionScheme })}
        onClick={e => e.stopPropagation()}
        className={`${INPUT_CLASS} min-w-[120px]`}
        aria-label="Схема подключения (k_подкл)"
        title="Схема подключения"
      >
        {CONNECTIONS.map(c => (
          <option key={c} value={c}>{CONNECTION_LABELS[c]}</option>
        ))}
      </select>
      <select
        value={installation}
        onChange={e => onChange({ installation: e.target.value as InstallationPlace })}
        onClick={e => e.stopPropagation()}
        className={`${INPUT_CLASS} min-w-[140px]`}
        aria-label="Место установки (k_устан)"
        title="Место установки"
      >
        {INSTALLATIONS.map(i => (
          <option key={i} value={i}>{INSTALLATION_LABELS[i]}</option>
        ))}
      </select>
    </div>
  )
}
