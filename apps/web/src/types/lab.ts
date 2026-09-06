export type LabSampleType = 'NONE' | 'BLOOD' | 'SERUM' | 'URINE' | 'SWAB' | 'SPUTUM' | 'OTHER';

export type LabProcedure = {
  id: string;
  code: string;
  name: string;
  department: string;
  sampleType: LabSampleType;
  price: number;
  tatHours: number;
  instructions?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LabExecutedPeriod = {
  tests: number;
  invoices: number;
  revenue: number;
};

export type LabBilledTest = {
  id: string;
  description: string;
  quantity: number;
  lineTotal: number;
  invoiceNumber?: string;
  issueDate?: string;
  patientName?: string;
  patientNumber?: string;
};

export type LabDashboard = {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { department: string; count: number }[];
  recent: LabProcedure[];
  executed: {
    today: LabExecutedPeriod;
    week: LabExecutedPeriod;
    month: LabExecutedPeriod;
  };
  executedByDepartment: { department: string; tests: number }[];
  topProcedures: { name: string; department: string; tests: number; revenue: number }[];
  recentBilled: LabBilledTest[];
};
