'use client';

import { CAREGIVER_PERMISSIONS, type CaregiverPermissions } from '@vidalog/core';

export function PermissionsEditor({
  value,
  onChange,
  readOnly,
}: {
  value: CaregiverPermissions;
  onChange?: (v: CaregiverPermissions) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      {CAREGIVER_PERMISSIONS.map((perm) => (
        <div key={perm.key} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-fg">{perm.label}</p>
            <p className="text-xs text-muted">{perm.description}</p>
          </div>
          <button
            role="switch"
            aria-checked={value[perm.key]}
            disabled={readOnly}
            onClick={() => onChange?.({ ...value, [perm.key]: !value[perm.key] })}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${value[perm.key] ? 'bg-emerald-500' : 'bg-white/15'} ${readOnly ? 'opacity-60' : ''}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value[perm.key] ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
