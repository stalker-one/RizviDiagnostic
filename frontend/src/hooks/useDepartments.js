import { useSettings } from '../context/SettingsContext.jsx';

// Fallback list used only until settings finish loading, or if an admin's
// settings somehow end up with an empty departments array — Doctors,
// Patients and Procedures all call this so they show the same list the
// admin manages from Settings > Departments.
export const DEFAULT_DEPARTMENTS = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Procedure', 'General'];

export default function useDepartments() {
  const { settings } = useSettings();
  if (Array.isArray(settings?.departments) && settings.departments.length > 0) {
    return settings.departments;
  }
  return DEFAULT_DEPARTMENTS;
}
