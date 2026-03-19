import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrgStore {
  currentOrgId: string | null;
  setCurrentOrg: (orgId: string) => void;
  clearOrg: () => void;
}

export const useOrgStore = create<OrgStore>()(
  persist(
    (set) => ({
      currentOrgId: null,
      setCurrentOrg: (orgId: string) => set({ currentOrgId: orgId }),
      clearOrg: () => set({ currentOrgId: null }),
    }),
    {
      name: 'clarixbi-org-store',
    },
  ),
);
