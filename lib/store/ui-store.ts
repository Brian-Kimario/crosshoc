import { create } from "zustand";

interface GroupInfo {
  id: string;
  name: string;
  currency: string;
  members: { id: string; name: string }[];
}

interface UIStore {
  createGroupOpen: boolean;
  joinGroupOpen: boolean;
  addExpenseOpen: boolean;
  groupSelectOpen: boolean;
  selectedGroup: GroupInfo | null;
  sidebarOpen: boolean;
  setCreateGroupOpen: (v: boolean) => void;
  setJoinGroupOpen: (v: boolean) => void;
  setAddExpenseOpen: (v: boolean) => void;
  setGroupSelectOpen: (v: boolean) => void;
  setSelectedGroup: (group: GroupInfo | null) => void;
  setSidebarOpen: (v: boolean) => void;
  openAddExpense: (group: GroupInfo) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  createGroupOpen: false,
  joinGroupOpen: false,
  addExpenseOpen: false,
  groupSelectOpen: false,
  selectedGroup: null,
  sidebarOpen: false,
  setCreateGroupOpen: (v) => {
    console.log("UIStore: setCreateGroupOpen", v);
    set({ createGroupOpen: v });
  },
  setJoinGroupOpen: (v) => {
    console.log("UIStore: setJoinGroupOpen", v);
    set({ joinGroupOpen: v });
  },
  setAddExpenseOpen: (v) => {
    console.log("UIStore: setAddExpenseOpen", v);
    set({ addExpenseOpen: v });
  },
  setGroupSelectOpen: (v) => {
    console.log("UIStore: setGroupSelectOpen", v);
    set({ groupSelectOpen: v });
  },
  setSelectedGroup: (group) => {
    console.log("UIStore: setSelectedGroup", group);
    set({ selectedGroup: group });
  },
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  openAddExpense: (group) => {
    console.log("UIStore: openAddExpense", group);
    set({ selectedGroup: group, addExpenseOpen: true });
  },
}));
