import React, { useContext } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import AuthContext from "./Authentication/Context/AuthContext";
import { getLandingPage } from "./Utils/roleAccess";
import { Layout, Col, Row } from "antd";
import Header from "./Header/Header";
import LeftTabs from "./LeftTabs/LeftTabs";
import Dashboard from "./Dashboard/Dashboard";
import Home from "./Home/Home";
import ImmigrationDashboard from "./ImmigrationDashboard/ImmigrationDashboard";
import WorkForce from "./WorkForce/WorkForce";
import EmployeeOnboard from "./EmployeeOnboard/EmployeeOnboard";
import CustomerDetails from "./Customer/CustomerDetails";
import VendorDetails from "./Vendor/VendorDetails";
import CustomerDashboard from "./CustomerDashboard/CustomerDashboard";
import VendorDashboard from "./VendorDashboard/VendorDashboard";
import CustomerFullDetailsComponent from "./CustomerDetailsComponent/CustomerFullDetailsComponent";
import VendorFullDetailsComponent from "./VendorDetailsComponent/VendorFullDetailsComponent";
import InvoiceDetails from "./Invoice/InvoiceDetails";
import ExpenseDetails from "./Expense/ExpenseDetails";
import CompanyFinalReportDetails from "./CompanyDashboard/CompanyFinalReportDetails";
import EmployeeFullDetailsComponent from "./EmployeeDetailsComponent/EmployeeFullDetailsComponent";
import EmployeeDetailDashboard from "./EmployeeDetailDashboard/EmployeeDetailDashboard";
import ProjectDashboard from "./Project/ProjectDashboard";
import ProjectOnBoardingForm from "./OnBoardingComponent/ProjectOnBoarding";
import ProjectFullDetails from "./Project/ProjectFullDetails";
import GenerateInvoiceDetails from "./Invoice/GenerateInvoiceDetails";
import { AuthProvider } from "./Authentication/Context/AuthContext";
import Login from "./Authentication/pages/Login";
import ProtectedRoute from "./Authentication/routes/ProtectedRoute";
import AuthLayout from "./Layouts/AuthLayout";
import MainLayout from "./Layouts/MainLayout";
import PotentialEmployees from "./PotentialEmployees/PotentialEmployees";
import VisaEmployees from "./VisaDetails/VisaEmployees.jsx"
import LCADetails from "./VisaDetails/LCADetails.jsx"
import VisaMasterList from "./VisaDetails/VisaMasterList.jsx"
import AdjustmentDetails from "./Adjustments/AdjustmentDetails";
import PayrollSummary from "./Payroll/PayrollSummary";
import PayrollEligibility from "./Payroll/PayrollEligibility";
import HealthInsuranceSummary from "./HealthInsurance/HealthInsuranceSummary";
import TimesheetEntry from "./Timesheet/TimesheetEntry";
import MonthlyTimesheets from "./Timesheet/MonthlyTimesheets";
import MasterDataLoad from "./MasterDataLoad/MasterDataLoad";
import HoursReport from "./HoursReport/HoursReport";
import ProjectInvoiceSummary from "./ProjectInvoiceSummary/ProjectInvoiceSummary";
import ImmigrationIntake from "./ImmigrationIntake/ImmigrationIntake";
import AllBills from "./Billings/AllBills";
import BillingIntegrityReport from "./Billings/BillingIntegrityReport";
import I9TasksReport from "./I9/I9TasksReport";
import UserRoles from "./Admin/UserRoles";
import PendingRequests from "./Admin/PendingRequests";
const clientId = '34277343649-4552ljfqc3ccsipco8jbf7jr3mu279j0.apps.googleusercontent.com';
const { Content } = Layout;

// Unknown URLs bounce to the current user's landing page (role-aware —
// see roleAccess.js getLandingPage) rather than a hardcoded /home.
const DefaultRedirect = () => {
  const { user } = useContext(AuthContext);
  return <Navigate to={getLandingPage(user?.role)} />;
};

const App = () => {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Authentication Layout (No Header, No Sidebar) */}
            <Route element={<AuthLayout />}>
              <Route path="/" element={<Login />} />
            </Route>
            {/* Main Application Layout (Protected) */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/workforce" element={<WorkForce />} />
              <Route path="/home" element={<Home />} />
              <Route path="/immigrationDashboard" element={<ImmigrationDashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/employeeonboard" element={<EmployeeOnboard />} />
              <Route path="/customerdetails" element={<CustomerDetails />} />
              <Route path="/vendordetails" element={<VendorDetails />} />
              <Route path="/customerDashboard" element={<CustomerDashboard />} />
              <Route path="/vendorDashboard" element={<VendorDashboard />} />
              <Route path="/customerFullDetails" element={<CustomerFullDetailsComponent />} />
              <Route path="/vendorFullDetails" element={<VendorFullDetailsComponent />} />
              <Route path="/invoicedetails" element={<InvoiceDetails />} />
              <Route path="/expensedetails" element={<ExpenseDetails />} />
              <Route path="/companyreport" element={<CompanyFinalReportDetails />} />
              <Route path="/masterdataload" element={<MasterDataLoad />} />
              <Route path="/pendingRequests" element={<PendingRequests />} />
              <Route path="/userAccess" element={<UserRoles />} />
              <Route path="/payrollsummary" element={<PayrollSummary />} />
              <Route path="/payrolleligibility" element={<PayrollEligibility />} />
              <Route path="/healthinsurance" element={<HealthInsuranceSummary />} />
              <Route path="/timesheets" element={<TimesheetEntry />} />
              <Route path="/monthlytimesheets" element={<MonthlyTimesheets />} />
              <Route path="/hoursreport" element={<HoursReport />} />
              <Route path="/projectInvoiceSummary" element={<ProjectInvoiceSummary />} />
              <Route path="/immigrationIntake" element={<ImmigrationIntake />} />
              <Route path="/allBills" element={<AllBills />} />
              <Route path="/billingIntegrityReport" element={<BillingIntegrityReport />} />
              <Route path="/i9TasksReport" element={<I9TasksReport />} />
              <Route
                path="/employeeFullDetails"
                element={<EmployeeFullDetailsComponent />}
              />
              <Route
                path="/employeeDetailDashboard"
                element={<EmployeeDetailDashboard />}
              />
              <Route
                path="/ProjectOnBoardingForm"
                element={<ProjectOnBoardingForm />}
              />
              <Route path="/projects" element={<ProjectDashboard />} />
              <Route
                path="/projectFullDetails"
                element={<ProjectFullDetails />}
              />
              <Route
                path="/generateInvoice"
                element={<GenerateInvoiceDetails />}
              />
               <Route
                path="/potentialEmployees"
                element={<PotentialEmployees />}
              />
               <Route
                path="/visaEmployees"
                element={<VisaEmployees />}
              />
              <Route
                path="/lcaDetails"
                element={<LCADetails />}
              />
              <Route
                path="/visaDetails"
                element={<VisaMasterList />}
              />
              <Route
                path="/adjustmentDetails"
                element={<AdjustmentDetails />}
              />
              <Route
                path="/payrollsummary"
                element={<PayrollSummary />}
              />

              {/* Redirect unknown routes to Home */}
              <Route path="*" element={<DefaultRedirect />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
