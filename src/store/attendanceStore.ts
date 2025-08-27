import { create } from 'zustand';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  store: string;
  date: string;
  shift: 'AM' | 'PM';
  scheduled_in: string;
  scheduled_out: string;
  actual_in: string | null;
  actual_out: string | null;
  status: 'Present' | 'Absent' | 'Late' | 'Early-out';
  scheduled_hours: number;
  hours_worked: number;
  attendance_pct: number;
  is_tardy: boolean;
  is_early_out: boolean;
}

export interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  store: string;
  worked_shifts: number;
  scheduled_shifts: number;
  shifts_attendance_pct: number;
  hours_worked: number;
  hours_scheduled: number;
  hours_attendance_pct: number;
  attendance_pct: number;
  tardy_count: number;
  early_out_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
}

export interface TeamKPIs {
  total_worked_shifts: number;
  total_scheduled_shifts: number;
  shifts_attendance_pct: number;
  total_hours_worked: number;
  total_hours_scheduled: number;
  hours_attendance_pct: number;
  total_tardy_count: number;
  total_early_out_count: number;
  tardiness_pct: number;
  early_dismissal_pct: number;
}

interface Filters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  store: string;
  status: string;
  search: string;
}

interface AttendanceState {
  records: AttendanceRecord[];
  employees: EmployeeSummary[];
  teamKPIs: TeamKPIs;
  filters: Filters;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setRecords: (records: AttendanceRecord[]) => void;
  setFilters: (filters: Partial<Filters>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
  
  // Selectors
  getFilteredRecords: () => AttendanceRecord[];
  getEmployeeRecords: (employeeId: string) => AttendanceRecord[];
  getStores: () => string[];
}

const initialFilters: Filters = {
  dateRange: { from: null, to: null },
  store: 'All stores',
  status: 'All',
  search: '',
};

const calculateEmployeeSummary = (records: AttendanceRecord[], employeeId: string): EmployeeSummary => {
  const employeeRecords = records.filter(r => r.employee_id === employeeId);
  
  if (employeeRecords.length === 0) {
    return {
      employee_id: employeeId,
      employee_name: '',
      employee_code: '',
      store: '',
      worked_shifts: 0,
      scheduled_shifts: 0,
      shifts_attendance_pct: 0,
      hours_worked: 0,
      hours_scheduled: 0,
      hours_attendance_pct: 0,
      attendance_pct: 0,
      tardy_count: 0,
      early_out_count: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
    };
  }

  const first = employeeRecords[0];
  const worked_shifts = employeeRecords.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Early-out').length;
  const scheduled_shifts = employeeRecords.length;
  const hours_worked = employeeRecords.reduce((sum, r) => sum + r.hours_worked, 0);
  const hours_scheduled = employeeRecords.reduce((sum, r) => sum + r.scheduled_hours, 0);
  const tardy_count = employeeRecords.filter(r => r.is_tardy).length;
  const early_out_count = employeeRecords.filter(r => r.is_early_out).length;
  const present_count = employeeRecords.filter(r => r.status === 'Present').length;
  const absent_count = employeeRecords.filter(r => r.status === 'Absent').length;
  const late_count = employeeRecords.filter(r => r.status === 'Late').length;

  return {
    employee_id: employeeId,
    employee_name: first.employee_name,
    employee_code: first.employee_code,
    store: first.store,
    worked_shifts,
    scheduled_shifts,
    shifts_attendance_pct: scheduled_shifts > 0 ? (worked_shifts / scheduled_shifts) * 100 : 0,
    hours_worked,
    hours_scheduled,
    hours_attendance_pct: hours_scheduled > 0 ? (hours_worked / hours_scheduled) * 100 : 0,
    attendance_pct: hours_scheduled > 0 ? (hours_worked / hours_scheduled) * 100 : 0,
    tardy_count,
    early_out_count,
    present_count,
    absent_count,
    late_count,
  };
};

const calculateTeamKPIs = (employees: EmployeeSummary[]): TeamKPIs => {
  if (employees.length === 0) {
    return {
      total_worked_shifts: 0,
      total_scheduled_shifts: 0,
      shifts_attendance_pct: 0,
      total_hours_worked: 0,
      total_hours_scheduled: 0,
      hours_attendance_pct: 0,
      total_tardy_count: 0,
      total_early_out_count: 0,
      tardiness_pct: 0,
      early_dismissal_pct: 0,
    };
  }

  const totals = employees.reduce(
    (acc, emp) => ({
      worked_shifts: acc.worked_shifts + emp.worked_shifts,
      scheduled_shifts: acc.scheduled_shifts + emp.scheduled_shifts,
      hours_worked: acc.hours_worked + emp.hours_worked,
      hours_scheduled: acc.hours_scheduled + emp.hours_scheduled,
      tardy_count: acc.tardy_count + emp.tardy_count,
      early_out_count: acc.early_out_count + emp.early_out_count,
    }),
    { worked_shifts: 0, scheduled_shifts: 0, hours_worked: 0, hours_scheduled: 0, tardy_count: 0, early_out_count: 0 }
  );

  return {
    total_worked_shifts: totals.worked_shifts,
    total_scheduled_shifts: totals.scheduled_shifts,
    shifts_attendance_pct: totals.scheduled_shifts > 0 ? (totals.worked_shifts / totals.scheduled_shifts) * 100 : 0,
    total_hours_worked: totals.hours_worked,
    total_hours_scheduled: totals.hours_scheduled,
    hours_attendance_pct: totals.hours_scheduled > 0 ? (totals.hours_worked / totals.hours_scheduled) * 100 : 0,
    total_tardy_count: totals.tardy_count,
    total_early_out_count: totals.early_out_count,
    tardiness_pct: totals.worked_shifts > 0 ? (totals.tardy_count / totals.worked_shifts) * 100 : 0,
    early_dismissal_pct: totals.worked_shifts > 0 ? (totals.early_out_count / totals.worked_shifts) * 100 : 0,
  };
};

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: [],
  employees: [],
  teamKPIs: {
    total_worked_shifts: 0,
    total_scheduled_shifts: 0,
    shifts_attendance_pct: 0,
    total_hours_worked: 0,
    total_hours_scheduled: 0,
    hours_attendance_pct: 0,
    total_tardy_count: 0,
    total_early_out_count: 0,
    tardiness_pct: 0,
    early_dismissal_pct: 0,
  },
  filters: initialFilters,
  isLoading: false,
  error: null,

  setRecords: (records: AttendanceRecord[]) => {
    const uniqueEmployeeIds = [...new Set(records.map(r => r.employee_id))];
    const employees = uniqueEmployeeIds.map(id => calculateEmployeeSummary(records, id));
    const teamKPIs = calculateTeamKPIs(employees);
    
    set({ records, employees, teamKPIs });
  },

  setFilters: (newFilters: Partial<Filters>) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error }),
  clearData: () => set({ 
    records: [], 
    employees: [], 
    teamKPIs: {
      total_worked_shifts: 0,
      total_scheduled_shifts: 0,
      shifts_attendance_pct: 0,
      total_hours_worked: 0,
      total_hours_scheduled: 0,
      hours_attendance_pct: 0,
      total_tardy_count: 0,
      total_early_out_count: 0,
      tardiness_pct: 0,
      early_dismissal_pct: 0,
    }
  }),

  getFilteredRecords: () => {
    const { records, filters } = get();
    
    return records.filter(record => {
      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const recordDate = new Date(record.date);
        if (filters.dateRange.from && recordDate < startOfDay(filters.dateRange.from)) return false;
        if (filters.dateRange.to && recordDate > endOfDay(filters.dateRange.to)) return false;
      }
      
      // Store filter
      if (filters.store !== 'All stores' && record.store !== filters.store) return false;
      
      // Status filter
      if (filters.status !== 'All') {
        if (filters.status === 'Present' && record.status !== 'Present') return false;
        if (filters.status === 'Absent' && record.status !== 'Absent') return false;
        if (filters.status === 'Late' && !record.is_tardy) return false;
        if (filters.status === 'Early-out' && !record.is_early_out) return false;
      }
      
      // Search filter
      if (filters.search && !record.employee_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      
      return true;
    });
  },

  getEmployeeRecords: (employeeId: string) => {
    const { records } = get();
    return records.filter(r => r.employee_id === employeeId);
  },

  getStores: () => {
    const { records } = get();
    const stores = [...new Set(records.map(r => r.store))];
    return stores.sort();
  },
}));