import { useEffect, useState } from 'react';
import { findSignatory, signatoryService, type SignatoryPosition } from '@/services/signatoryService';

type Props = {
  position: SignatoryPosition;
  regionId?: string | null;
  fallbackName?: string;
  fallbackNip?: string;
  nipClassName?: string;
};

export default function SignatoryText({ position, regionId, fallbackName = '____________________________', fallbackNip = '____________________________', nipClassName }: Props) {
  const [value, setValue] = useState({ name: fallbackName, nip: fallbackNip });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const saved = findSignatory(await signatoryService.getAll(), position, regionId);
      if (mounted && saved) setValue({ name: saved.name, nip: saved.nip || '____________________________' });
    };
    void load();
    window.addEventListener('signatories-updated', load);
    return () => { mounted = false; window.removeEventListener('signatories-updated', load); };
  }, [position, regionId]);

  return <><p className="font-bold underline">{value.name}</p><p className={nipClassName}>{value.nip}</p></>;
}
