import { Route, Routes } from 'react-router'
import { ToastProvider } from '@/design-system'
import { AppProvider } from '@/data/store'
import { Shell } from './Shell'
import { RouteGuard } from './RouteGuard'

import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { PatientsPage } from '@/modules/patients/PatientsPage'
import { PatientDetailPage } from '@/modules/patients/PatientDetailPage'
import { AppointmentsPage } from '@/modules/appointments/AppointmentsPage'
import { TreatmentsPage } from '@/modules/treatments/TreatmentsPage'
import { FollowUpsPage } from '@/modules/followups/FollowUpsPage'
import { TasksPage } from '@/modules/tasks/TasksPage'
import { LeadsPage } from '@/modules/leads/LeadsPage'
import { CalendarPage } from '@/modules/calendar/CalendarPage'
import { TimelinePage } from '@/modules/timeline/TimelinePage'
import { SearchPage } from '@/modules/search/SearchPage'
import { ReportsPage } from '@/modules/reports/ReportsPage'
import { UsersPage } from '@/modules/users/UsersPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { DesignSystemPage } from '@/modules/designsystem/DesignSystemPage'
import { DocsPage } from '@/modules/docs/DocsPage'
import { NotFoundPage } from '@/modules/NotFoundPage'

export function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<DashboardPage />} />

            <Route
              path="patients"
              element={
                <RouteGuard permission="patients.view">
                  <PatientsPage />
                </RouteGuard>
              }
            />
            <Route
              path="patients/:patientId"
              element={
                <RouteGuard permission="patients.view">
                  <PatientDetailPage />
                </RouteGuard>
              }
            />

            <Route
              path="appointments"
              element={
                <RouteGuard permission="appointments.view">
                  <AppointmentsPage />
                </RouteGuard>
              }
            />

            <Route
              path="treatments"
              element={
                <RouteGuard permission="treatments.view">
                  <TreatmentsPage />
                </RouteGuard>
              }
            />

            <Route
              path="follow-ups"
              element={
                <RouteGuard permission="followups.view">
                  <FollowUpsPage />
                </RouteGuard>
              }
            />

            <Route
              path="tasks"
              element={
                <RouteGuard permission="tasks.view">
                  <TasksPage />
                </RouteGuard>
              }
            />

            <Route
              path="leads"
              element={
                <RouteGuard permission="leads.view">
                  <LeadsPage />
                </RouteGuard>
              }
            />

            <Route
              path="calendar"
              element={
                <RouteGuard permission="calendar.view">
                  <CalendarPage />
                </RouteGuard>
              }
            />

            <Route
              path="timeline"
              element={
                <RouteGuard permission="timeline.view">
                  <TimelinePage />
                </RouteGuard>
              }
            />

            <Route path="search" element={<SearchPage />} />

            <Route
              path="reports"
              element={
                <RouteGuard permission="reports.view">
                  <ReportsPage />
                </RouteGuard>
              }
            />

            <Route
              path="users"
              element={
                <RouteGuard permission="users.view">
                  <UsersPage />
                </RouteGuard>
              }
            />

            <Route
              path="settings"
              element={
                <RouteGuard permission="settings.view">
                  <SettingsPage />
                </RouteGuard>
              }
            />

            <Route path="design-system" element={<DesignSystemPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="docs/:slug" element={<DocsPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AppProvider>
  )
}
