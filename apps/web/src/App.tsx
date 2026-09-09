import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DashboardBuilderPage } from './pages/dashboard/DashboardBuilderPage';
import { PatientsListPage } from './pages/patients/PatientsListPage';
import { PatientCreatePage } from './pages/patients/PatientCreatePage';
import { PatientModifyPage } from './pages/patients/PatientModifyPage';
import { PatientSearchPage } from './pages/patients/PatientSearchPage';
import { PatientDetailPage } from './pages/patients/PatientDetailPage';
import { PatientEditPage } from './pages/patients/PatientEditPage';
import { PatientDocumentsPage } from './pages/patients/PatientDocumentsPage';
import { ClinicalCreatePage } from './pages/clinical/ClinicalCreatePage';
import { TherapyCasesListPage } from './pages/therapy/TherapyCasesListPage';
import { TherapyCreatePage } from './pages/therapy/TherapyCreatePage';
import { TherapyDetailPage } from './pages/therapy/TherapyDetailPage';
import { TherapyPackagesPage } from './pages/therapy/TherapyPackagesPage';
import { DoctorSessionsPage } from './pages/doctor/DoctorSessionsPage';
import { DoctorSessionWorkspacePage } from './pages/doctor/DoctorSessionWorkspacePage';
import { AppointmentsListPage } from './pages/appointments/AppointmentsListPage';
import { AssignDoctorPage } from './pages/appointments/AssignDoctorPage';
import { AppointmentsCalendarPage } from './pages/appointments/AppointmentsCalendarPage';
import { AppointmentDaySchedulerPage } from './pages/appointments/AppointmentDaySchedulerPage';
import { AppointmentSlotsPage } from './pages/appointments/AppointmentSlotsPage';
import { AppointmentDetailPage } from './pages/appointments/AppointmentDetailPage';
import { LabDashboardPage } from './pages/lab/LabDashboardPage';
import { LabProcedureCreatePage } from './pages/lab/LabProcedureCreatePage';
import { InvoicesListPage } from './pages/billing/InvoicesListPage';
import { InvoiceCreatePage } from './pages/billing/InvoiceCreatePage';
import { InvoiceDetailPage } from './pages/billing/InvoiceDetailPage';
import { InvoicePrintPage } from './pages/billing/InvoicePrintPage';
import { BillingReportPage } from './pages/billing/BillingReportPage';
import { RevenueReportPage } from './pages/billing/RevenueReportPage';
import { OpRegistrationReceiptPage } from './pages/patients/OpRegistrationReceiptPage';
import { ServiceMasterPage } from './pages/patients/ServiceMasterPage';
import { PaymentsPage } from './pages/billing/PaymentsPage';
import { InventoryOverviewPage } from './pages/inventory/InventoryOverviewPage';
import { InventoryItemMasterPage } from './pages/inventory/InventoryItemMasterPage';
import { InventoryStockReportPage } from './pages/inventory/InventoryStockReportPage';
import { InventorySalesReportPage } from './pages/inventory/InventorySalesReportPage';
import { InventoryStockEntryPage } from './pages/inventory/InventoryStockEntryPage';
import { InventoryReturnRequestsPage } from './pages/inventory/InventoryReturnRequestsPage';
import { InventoryReturnsReportPage } from './pages/inventory/InventoryReturnsReportPage';
import { InventorySuppliersPage } from './pages/inventory/InventorySuppliersPage';
// WhatsApp communication disabled in v1
// import { CommunicationPage } from './pages/communication/CommunicationPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { AiPage } from './pages/ai/AiPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RolesPage } from './pages/admin/RolesPage';
import { AuditPage } from './pages/admin/AuditPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { ClinicSetupPage } from './pages/onboarding/ClinicSetupPage';
import { PricingPage } from './pages/subscription/PricingPage';
import { SubscriptionBillingPage } from './pages/subscription/SubscriptionBillingPage';
import { SubscriptionCheckoutPage } from './pages/subscription/SubscriptionCheckoutPage';
import { SubscriptionPaymentsPage } from './pages/subscription/SubscriptionPaymentsPage';
import { SubscriptionInvoicesPage } from './pages/subscription/SubscriptionInvoicesPage';
import { ClinicSignupPage } from './pages/subscription/ClinicSignupPage';
import { PlatformLayout } from './pages/platform/PlatformLayout';
import { PlatformDashboardPage } from './pages/platform/PlatformDashboardPage';
import { PlatformSubscriptionsPage } from './pages/platform/PlatformSubscriptionsPage';
import { PlatformSubscriptionDetailPage } from './pages/platform/PlatformSubscriptionDetailPage';
import {
  PlatformPaymentsPage,
  PlatformInvoicesPage,
  PlatformWebhooksPage,
} from './pages/platform/PlatformListsPages';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/signup" element={<ClinicSignupPage />} />
      <Route path="/register" element={<ClinicSignupPage />} />

      <Route
        path="/platform"
        element={
          <ProtectedRoute pathOverride="/platform">
            <PlatformLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PlatformDashboardPage />} />
        <Route path="subscriptions" element={<PlatformSubscriptionsPage />} />
        <Route path="subscriptions/:id" element={<PlatformSubscriptionDetailPage />} />
        <Route path="payments" element={<PlatformPaymentsPage />} />
        <Route path="invoices" element={<PlatformInvoicesPage />} />
        <Route path="webhooks" element={<PlatformWebhooksPage />} />
      </Route>

      <Route
        path="/billing/:id/print"
        element={
          <ProtectedRoute pathOverride="/billing">
            <InvoicePrintPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patients/op-receipt/:id"
        element={
          <ProtectedRoute pathOverride="/patients">
            <OpRegistrationReceiptPage />
          </ProtectedRoute>
        }
      />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/:role" element={<DashboardPage />} />
        <Route path="/dashboard-builder" element={<DashboardBuilderPage />} />

        {/* Patients */}
        <Route path="/patients" element={<PatientsListPage />} />
        <Route path="/patients/new" element={<PatientCreatePage />} />
        <Route path="/patients/modify" element={<PatientModifyPage />} />
        <Route path="/patients/lookup" element={<PatientSearchPage />} />
        <Route path="/patients/op-new" element={<ClinicalCreatePage />} />
        <Route path="/patients/op-review" element={<ClinicalCreatePage />} />
        <Route path="/patients/services" element={<ServiceMasterPage />} />
        <Route path="/patients/op-report" element={<Navigate to="/patients" replace />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/patients/:id/edit" element={<PatientEditPage />} />
        <Route path="/patients/:id/documents" element={<PatientDocumentsPage />} />

        {/* Doctor clinical workspace */}
        <Route path="/doctor/sessions" element={<DoctorSessionsPage />} />
        <Route path="/doctor/sessions/:sessionId" element={<DoctorSessionWorkspacePage />} />

        {/* Appointments (therapy sessions only) */}
        <Route path="/appointments" element={<AppointmentsListPage />} />
        <Route path="/appointments/assign/:patientId" element={<AssignDoctorPage />} />
        <Route path="/appointments/calendar" element={<AppointmentsCalendarPage />} />
        <Route path="/appointments/day" element={<AppointmentDaySchedulerPage />} />
        <Route path="/appointments/slots" element={<AppointmentSlotsPage />} />
        <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

        <Route path="/reception" element={<Navigate to="/appointments" replace />} />
        <Route path="/reception/*" element={<Navigate to="/appointments" replace />} />

        <Route path="/clinical" element={<Navigate to="/patients" replace />} />
        <Route path="/clinical/new" element={<Navigate to="/patients/new?intent=op" replace />} />
        <Route path="/clinical/:id" element={<Navigate to="/patients" replace />} />

        {/* Therapy */}
        <Route path="/therapy" element={<TherapyCasesListPage />} />
        <Route path="/therapy/new" element={<TherapyCreatePage />} />
        <Route path="/therapy/sessions" element={<Navigate to="/appointments" replace />} />
        <Route path="/therapy/packages" element={<TherapyPackagesPage />} />
        <Route path="/therapy/:id" element={<TherapyDetailPage />} />

        {/* Audio (lab routes) */}
        <Route path="/lab" element={<LabDashboardPage />} />
        <Route path="/lab/procedures/new" element={<LabProcedureCreatePage />} />

        {/* Billing */}
        <Route path="/billing" element={<InvoicesListPage />} />
        <Route path="/billing/new" element={<InvoiceCreatePage />} />
        <Route path="/billing/report" element={<BillingReportPage />} />
        <Route path="/billing/revenue" element={<RevenueReportPage />} />
        <Route path="/billing/payments" element={<PaymentsPage />} />
        <Route path="/billing/:id" element={<InvoiceDetailPage />} />

        {/* Inventory */}
        <Route path="/inventory" element={<InventoryOverviewPage />} />
        <Route path="/inventory/items" element={<InventoryItemMasterPage />} />
        <Route path="/inventory/stock" element={<InventoryStockReportPage />} />
        <Route path="/inventory/sales" element={<InventorySalesReportPage />} />
        <Route path="/inventory/movements" element={<InventoryStockEntryPage />} />
        <Route path="/inventory/returns" element={<InventoryReturnRequestsPage />} />
        <Route path="/inventory/returns-report" element={<InventoryReturnsReportPage />} />
        <Route path="/inventory/suppliers" element={<InventorySuppliersPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        {/* WhatsApp communication disabled in v1 */}
        {/* <Route path="/communication" element={<CommunicationPage />} /> */}
        {/* <Route path="/communication/*" element={<CommunicationPage />} /> */}
        <Route path="/ai" element={<AiPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:type" element={<ReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/subscription" element={<SubscriptionBillingPage />} />
        <Route path="/subscription/checkout" element={<SubscriptionCheckoutPage />} />
        <Route path="/subscription/payments" element={<SubscriptionPaymentsPage />} />
        <Route path="/subscription/invoices" element={<SubscriptionInvoicesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/setup" element={<ClinicSetupPage />} />
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;