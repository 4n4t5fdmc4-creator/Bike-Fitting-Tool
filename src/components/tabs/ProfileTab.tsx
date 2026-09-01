'use client';

import type { Client } from '@/state/studio';
import { ClientPanel } from '../ClientPanel';

export function ProfileTab({ client }: { client: Client }) {
  return (
    <div className="space-y-4">
      <ClientPanel client={client} />
      <p className="text-xs text-[var(--text-3)]">
        Next: set up their bikes in the <b>Bikes</b> tab — either their current bike as a measured
        reference, or let the position be estimated from these measurements alone.
      </p>
    </div>
  );
}
