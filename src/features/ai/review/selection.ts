import { create } from "zustand";

interface ReviewSelectionState {
  selectedRowId: string | null;
  selectRow: (rowId: string | null) => void;
}

export const useReviewSelectionStore = create<ReviewSelectionState>()((set) => ({
  selectedRowId: null,
  selectRow: (rowId) => set({ selectedRowId: rowId }),
}));
