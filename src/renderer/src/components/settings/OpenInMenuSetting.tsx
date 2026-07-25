import type React from 'react'
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { GlobalSettings, OpenInApplication } from '../../../../shared/types'
import {
  createOpenInApplicationId,
  isOpenInApplicationIncomplete,
  OPEN_IN_APPLICATIONS_MAX
} from '../../../../shared/open-in-applications'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Label } from '../ui/label'
import {
  isOpenInAppPresetAdded,
  OpenInApplicationIcon,
  getOpenInAppPresets,
  type OpenInAppPreset
} from '@/lib/open-in-app-catalog'
import { OpenInMenuRow } from './OpenInMenuRow'
import { translate } from '@/i18n/i18n'

type OpenInMenuSettingProps = {
  applications: OpenInApplication[] | undefined
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

type OpenInApplicationsDraftState = {
  sourceApplications: OpenInApplication[] | undefined
  draft: OpenInApplication[]
}

function createOpenInApplication(): OpenInApplication {
  return {
    id: createOpenInApplicationId(),
    label: '',
    command: ''
  }
}

export function createPresetOpenInApplication(
  preset: OpenInAppPreset,
  takenIds: ReadonlySet<string> = new Set()
): OpenInApplication {
  return {
    // Why the preset's id is not unconditional: a seeded browser-editor row may already own
    // `vscode` or `cursor` (its favicon is keyed on that id), and normalizeOpenInApplications
    // dedupes by id keeping the FIRST row. Reusing a taken id would make "Add app → VS Code"
    // look like it did nothing at all.
    id: takenIds.has(preset.id) ? createOpenInApplicationId() : preset.id,
    label: preset.label,
    command: preset.command
  }
}

function createOpenInApplicationsDraftState(
  openInApplications: OpenInApplication[] | undefined
): OpenInApplicationsDraftState {
  return {
    sourceApplications: openInApplications,
    draft: openInApplications ?? []
  }
}

function resolveOpenInApplicationsDraftState(
  state: OpenInApplicationsDraftState,
  openInApplications: OpenInApplication[] | undefined
): OpenInApplicationsDraftState {
  return state.sourceApplications === openInApplications
    ? state
    : createOpenInApplicationsDraftState(openInApplications)
}

export function shouldCommitOpenInApplicationsDraft(applications: OpenInApplication[]): boolean {
  // Why this defers to the normalizer's own rule rather than restating one: whatever this pane
  // commits goes straight through `normalizeOpenInApplications`, so a second definition of
  // "finished" here would mean persisting rows the normalizer then silently drops. It had
  // required a `command`, which a browser-editor row by construction has none of — so one seeded
  // row made every write from this pane a no-op for as long as it existed.
  //
  // Why URL *validity* is deliberately not part of it: an unusable template is exactly what a
  // hand-edited store or a bad seed produces, and refusing to commit on it would re-create that
  // inert-pane bug. A bad URL is surfaced where it matters — inline in the editor, and as a
  // disabled "Invalid URL" item in the Open in menu.
  return applications.every((application) => !isOpenInApplicationIncomplete(application))
}

export function OpenInMenuSetting({
  applications,
  updateSettings
}: OpenInMenuSettingProps): React.JSX.Element {
  const [draftState, setDraftState] = useState(() =>
    createOpenInApplicationsDraftState(applications)
  )
  const [editingIds, setEditingIds] = useState<ReadonlySet<string>>(new Set())

  const resolvedDraftState = resolveOpenInApplicationsDraftState(draftState, applications)
  if (resolvedDraftState !== draftState) {
    // Why: the Open menu rows are editable local drafts, but Settings can
    // reload from persistence while this pane is mounted.
    setDraftState(resolvedDraftState)
  }
  const draft = resolvedDraftState.draft
  const isAtLimit = draft.length >= OPEN_IN_APPLICATIONS_MAX

  const commit = (nextDraft: OpenInApplication[]): void => {
    if (!shouldCommitOpenInApplicationsDraft(nextDraft)) {
      return
    }
    updateSettings({ openInApplications: nextDraft })
  }

  const updateDraft = (nextDraft: OpenInApplication[]): void => {
    setDraftState((current) => ({
      ...resolveOpenInApplicationsDraftState(current, applications),
      draft: nextDraft
    }))
  }

  const applyDraft = (nextDraft: OpenInApplication[]): void => {
    updateDraft(nextDraft)
    commit(nextDraft)
  }

  const addPreset = (preset: OpenInAppPreset): void => {
    if (isAtLimit || isOpenInAppPresetAdded(draft, preset)) {
      return
    }
    applyDraft([
      ...draft,
      createPresetOpenInApplication(preset, new Set(draft.map((entry) => entry.id)))
    ])
  }

  const addCustomApp = (): void => {
    if (isAtLimit) {
      return
    }
    const application = createOpenInApplication()
    updateDraft([...draft, application])
    setEditingIds((current) => new Set([...current, application.id]))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label>
            {translate('auto.components.settings.OpenInMenuSetting.6ed52fe71e', 'Open In Apps')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.OpenInMenuSetting.9d0413817d',
              "Choose apps available from a workspace's Open in menu."
            )}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAtLimit}
              className="h-8 shrink-0 gap-1.5"
            >
              {translate('auto.components.settings.OpenInMenuSetting.e4064916aa', 'Add app')}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {getOpenInAppPresets().map((preset) => {
              const isAdded = isOpenInAppPresetAdded(draft, preset)
              return (
                <DropdownMenuItem
                  key={preset.id}
                  disabled={isAdded || isAtLimit}
                  onSelect={() => addPreset(preset)}
                  className="gap-2"
                >
                  <OpenInApplicationIcon application={preset} size={14} />
                  <span className="min-w-0 truncate">{preset.label}</span>
                  {isAdded && (
                    <DropdownMenuShortcut className="inline-flex items-center gap-1">
                      <Check className="size-3" />
                      {translate('auto.components.settings.OpenInMenuSetting.c1d817e027', 'Added')}
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuItem disabled={isAtLimit} onSelect={addCustomApp} className="gap-2">
              <OpenInApplicationIcon application={{ command: '' }} size={14} />
              <span className="min-w-0 truncate">
                {translate('auto.components.settings.OpenInMenuSetting.03b00b1f64', 'Custom app')}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {draft.length > 0 && (
        <div className="divide-y divide-border/40">
          {draft.map((application, index) => {
            const editing =
              editingIds.has(application.id) || isOpenInApplicationIncomplete(application)
            return (
              <OpenInMenuRow
                key={application.id}
                application={application}
                editing={editing}
                onEditToggle={() =>
                  setEditingIds((current) => {
                    const next = new Set(current)
                    if (next.has(application.id)) {
                      next.delete(application.id)
                    } else {
                      next.add(application.id)
                    }
                    return next
                  })
                }
                onRemove={() => {
                  const next = draft.filter((entry) => entry.id !== application.id)
                  applyDraft(next)
                  setEditingIds((current) => {
                    const nextEditing = new Set(current)
                    nextEditing.delete(application.id)
                    return nextEditing
                  })
                }}
                onChange={(updates) => {
                  const next = [...draft]
                  next[index] = { ...application, ...updates }
                  updateDraft(next)
                }}
                onCommit={() => commit(draft)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
