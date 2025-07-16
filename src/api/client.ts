// API client for backend communication

const API_BASE_URL = 'http://localhost:8000';

export interface AttendanceData {
  employee_name: string;
  summary: {
    scheduled_shifts: number;
    shifts_worked: number;
    attendance_pct_shifts: number;
    scheduled_hours: number;
    worked_hours: number;
    attendance_pct_hours: number;
    tardy_count: number;
    early_dismissal_count: number;
  };
  day_level: Array<{
    date: string;
    shift_type: string;
    sched_start_dt: string;
    sched_end_dt: string;
    actual_in: string | null;
    actual_out: string | null;
    actual_out1: string | null;
    actual_in2: string | null;
    sched_minutes: number;
    worked_minutes: number;
    worked_minutes_clipped: number;
    attendance_fraction: number;
    present: boolean;
    tardy: boolean;
    early_dismissal: boolean;
  }>;
  config_used: any;
}

export interface PolicyConfig {
  am: {
    start: string;
    end: string;
    cross_midnight: boolean;
  };
  pm: {
    start: string;
    end: string;
    cross_midnight: boolean;
  };
  tardy_minutes: number;
  early_minutes: number;
  timezone: string;
}

class AttendanceAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async processAttendance(
    punchFile: File,
    scheduleFile: File,
    config?: PolicyConfig
  ): Promise<AttendanceData> {
    const formData = new FormData();
    formData.append('punch_file', punchFile);
    formData.append('schedule_file', scheduleFile);
    
    if (config) {
      formData.append('config', JSON.stringify(config));
    }

    const response = await fetch(`${this.baseUrl}/attendance/compute`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async downloadCSV(jobId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/attendance/${jobId}/csv`);
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }

    return response.blob();
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}

export const apiClient = new AttendanceAPIClient();
export default apiClient;