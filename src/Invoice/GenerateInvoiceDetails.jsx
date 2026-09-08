import React, { useState, useEffect, useRef } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Alert, Card } from "antd";
import { ReloadOutlined, ArrowLeftOutlined, CloseOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./Invoice.css";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditIcon from "@mui/icons-material/Edit";
import { IconButton } from "@mui/material";
import EditHoursInvoiceModal from "./EditHoursInvoiceModel";
import "./GenerateInvoiceDetails.css";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatMonthYear, formatDateMDY } from "../Utils/dateFormat";
import { computeInvoicePeriod } from "../Utils/invoiceTerm";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

const GenerateInvoiceDetails = ({ url: propUrl, employeeIds: propEmployeeIds, month: propMonth, selectedMonth: propSelectedMonth, onBack } = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url: stateUrl, employeeIds: stateEmployeeIds, month: stateMonth, selectedMonth: stateSelectedMonth } = location.state || {};
  const url = propUrl ?? stateUrl;
  // Bulk path (no single employee/project scoping this component to one
  // url): one row-set per active employee, fetched and combined the same
  // way the Invoice Details page's own Invoice Alerts bell does, so both
  // agree on what's actually outstanding.
  const employeeIds = propEmployeeIds ?? stateEmployeeIds;
  const month = propMonth ?? stateMonth;
  // yyyy-MM of the month picked on the Invoice Details page. Absent when
  // scoped to a single employee (that path isn't month-driven), in which
  // case every not-yet-invoiced period for that employee is still shown.
  const selectedMonth = propSelectedMonth ?? stateSelectedMonth;
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  // Captured from the raw (pre-filter) fetch so the "up to date" message
  // still has a name to show even once every row's been filtered out.
  const [employeeName, setEmployeeName] = useState("");
  // Guards the "up to date" message against showing during the brief
  // window before the first fetch resolves, when rowData is also still [].
  const [hasFetched, setHasFetched] = useState(false);
  const [editingRowData, setEditingRowData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invalidRows, setInvalidRows] = useState([]); // Track invalid rows
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);

  //  const columnsList = ['Customer Id', 'Company Name', 'Email Id', 'Phone', 'Status', 'ein', 'Website','startDate','endDate' ];
  const isInitialRender = useRef(true);
  // const formattedDate = selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : null;
  // const month = formattedDate
  // ? new Date(selectedDate).toLocaleString('default', { month: 'long' }) // Use 'short' for abbreviated month
  // : null;
  const gridRef = useRef();

  useEffect(() => {
    if (isInitialRender.current) {
      fetchData();
    } else {
      isInitialRender.current = false;
    }
  }, []);

  const fetchData = () => {
    if (employeeIds && employeeIds.length > 0) {
      Promise.all(
        employeeIds.map((employeeId) =>
          axios
            .get(API_ENDPOINTS.activeProjectsForInvoiceByEmployee(employeeId))
            .then((response) => response.data || [])
            .catch((error) => {
              console.error("Error fetching active projects for employee " + employeeId, error);
              return [];
            }),
        ),
      ).then((results) => {
        const combined = results.flat();
        setEmployeeName(combined?.[0]?.employeeName || "");
        const flattened = getFlattenedData(combined);
        setRowData(flattened);
        setHasFetched(true);
        populateHoursFromTimesheets(flattened);
      }).finally(() => {
        setLoading(false);
      });
      return;
    }

    axios
      .get(url, {
        params: {
          // selectedDate: '2023-11-01',//formattedDate,
          //status: 'viewAll'
        },
      })
      .then((response) => {
        setLoading(false);
        setEmployeeName(response.data?.[0]?.employeeName || "");
        const flattened = getFlattenedData(response.data);
        setRowData(flattened);
        setHasFetched(true);
        populateHoursFromTimesheets(flattened);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally((x) => {
        setLoading(false);
      });
  };

  // For rows with no hours entered yet, sum any timesheet hours already
  // logged for that employee/project within the row's own invoice period
  // and use that as the starting hours — one fetch per employee (covering
  // the widest date range across their rows) rather than one per row.
  const populateHoursFromTimesheets = (rows) => {
    const rowsByEmployee = {};
    rows.forEach((row) => {
      if (row.hours || !row.employeeId || !row.startDate || !row.endDate) return;
      if (!rowsByEmployee[row.employeeId]) rowsByEmployee[row.employeeId] = [];
      rowsByEmployee[row.employeeId].push(row);
    });

    const employeeIds = Object.keys(rowsByEmployee);
    if (employeeIds.length === 0) return;

    Promise.all(
      employeeIds.map((employeeId) => {
        const empRows = rowsByEmployee[employeeId];
        const minStart = empRows.reduce((min, r) => (r.startDate < min ? r.startDate : min), empRows[0].startDate);
        const maxEnd = empRows.reduce((max, r) => (r.endDate > max ? r.endDate : max), empRows[0].endDate);
        return axios
          .get(API_ENDPOINTS.getTimesheetsByEmployeeAndRange(employeeId, minStart, maxEnd))
          .then((response) => ({ employeeId, entries: response.data || [] }))
          .catch((error) => {
            console.error("Error fetching timesheet hours for employee " + employeeId, error);
            return { employeeId, entries: [] };
          });
      }),
    ).then((results) => {
      const entriesByEmployee = {};
      results.forEach(({ employeeId, entries }) => {
        entriesByEmployee[employeeId] = entries;
      });

      setRowData((prevRows) =>
        prevRows.map((row) => {
          if (row.hours || !row.employeeId || !row.startDate || !row.endDate) return row;
          const entries = entriesByEmployee[row.employeeId] || [];
          const totalHours = entries
            .filter(
              (e) =>
                e.projectId === row.projectId &&
                e.workDate >= row.startDate &&
                e.workDate <= row.endDate &&
                // Only pull hours from timesheets that have actually been
                // submitted (or approved) — a Draft entry isn't confirmed
                // yet, so it shouldn't silently seed an invoice's hours.
                (e.status === "Submitted" || e.status === "Approved"),
            )
            .reduce((sum, e) => sum + (e.hours || 0), 0);
          if (totalHours <= 0) return row;
          return { ...row, hours: totalHours, total: totalHours * (row.billRate || 0) };
        }),
      );
    });
  };

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ""; // Required for showing the browser alert
      }
    };
    const handlePopState = (event) => {
      if (hasUnsavedChanges) {
        const confirm = window.confirm(
          "You have unsaved changes. Do you still want to leave this page?",
        );
        if (!confirm) {
          // Push back to current page if the user cancels
          window.history.pushState(null, null, window.location.pathname);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges]);

  const getFlattenedData = (data) => {
    const today = new Date().toISOString().split("T")[0];
    let updatedData = data
      // Generate Invoice is for creating new invoices — a row that already
      // matched an existing invoice (invoiceId > 0) has nothing left to
      // generate, so it's dropped rather than shown alongside the rows that
      // still need one.
      .filter((dataObj) => !dataObj.invoiceId)
      // Don't offer to invoice a period that hasn't ended yet.
      .filter((dataObj) => !dataObj.endDate || dataObj.endDate <= today)
      // Restrict to the month picked on Invoice Details — otherwise every
      // not-yet-invoiced period (including earlier months) would show up
      // instead of just what's due for the selected month.
      .filter((dataObj) => !selectedMonth || (dataObj.startDate && dataObj.startDate.substring(0, 7) === selectedMonth))
      .map((dataObj) => {
        //return { ...dataObj, ...dataObj.employeeAddress[0], ...dataObj.employeeAssignments[0] }
        // Snapshot the project's own start/end date before startDate/endDate
        // get edited below to represent this invoice's period — these bounds
        // are what Start/End Date edits get validated against.
        return {
          ...dataObj,
          projectStartDate: dataObj.startDate,
          projectEndDate: dataObj.endDate,
          // Each row's startDate is already the first of its invoice month.
          invoiceMonth: dataObj.startDate,
        };
      });
    return updatedData || [];
  };

  //   const handleEdit = (params) => {
  //     setEditingRow(params.node.id);
  //     params.api.startEditingCell({ rowIndex: params.node.rowIndex, colKey: 'hours' });
  //   };

  const handleEdit = (params) => {
    setEditingRowData(params.data);
    setIsModalOpen(true);
  };

  // Jumps to the per-project Timesheet page pre-filtered to this row's
  // employee, project, and the calendar month its invoice period falls in,
  // so the "Timesheet" link shows exactly what was (or wasn't) logged for
  // that employee/project/month.
  const handleOpenTimesheet = (row) => {
    if (!row.employeeId || !row.startDate) return;
    navigate("/timesheets", {
      state: { employeeId: row.employeeId, projectId: row.projectId, yearMonth: row.startDate.substring(0, 7) },
    });
  };

  const handleSaveModal = async (updatedData) => {
    const updatedRow = { ...editingRowData, ...updatedData };
    updatedRow.total = updatedRow.hours * updatedRow.billRate;
    console.log(updatedRow);
    //setRowData(updatedRow)
    setIsModalOpen(false);

    const updatedDataToSave = [
      {
        ...updatedRow, // Spread the existing properties
        formatSelectedDate: updatedRow.startDate, // Add the new property
      },
    ];

    fetch(
      API_ENDPOINTS.addInvoices,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedDataToSave),
      },
    )
      .then((response) => response.json())
      .then((data) => {
        console.log("API Response:", data);
        setLoading(true); // Turn on loading before fetchData
        fetchData();
      })
      .catch((error) => console.error("API Error:", error));
  };

  const handleSave = () => {
    const invalidRowsIds = [];
    let isAllValid = true;

    // Validate each row
    // const updatedRowData = rowData.map((row) => {
    //   const isRowValid = (row.hours == 0 && row.invoiceNumber == 0) || (row.hours > 0 && row.invoiceNumber > 0);
    //   if (!isRowValid) {
    //     isAllValid = false;
    //     invalidRowsIds.push(row.projectId);
    //   }
    //   return row;
    // });
    // setInvalidRows(invalidRowsIds);

    if (!isAllValid) {
      alert("Some rows are invalid. Please fix the highlighted errors.");
    } else {
      setHasUnsavedChanges(false);
      const updatedDataToSave = rowData.map((item) => ({
        ...item, // Spread the existing properties
        formatSelectedDate: item.startDate, // Add the new property
      }));
      console.log(updatedDataToSave);
      fetch(
        API_ENDPOINTS.addInvoices,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedDataToSave),
        },
      )
        .then((response) => response.text())
        .then((data) => {
          console.log("API Response:", data);
          setLoading(true); // Turn on loading before fetchData
          fetchData();
        })
        .catch((error) => console.error("API Error:", error));
    }
  };

  const getColumnsDefList = (isSortable, isEditable, hasFilter) => {
    var columns = [
      {
        colId: "rowNum",
        headerName: "#",
        valueGetter: (params) => params.node.rowIndex + 1,
        width: 80, minWidth: 80, maxWidth: 80,
        pinned: "left", sortable: false, filter: false, editable: false,
        suppressSizeToFit: true,
        cellStyle: { textAlign: "center", fontWeight: 500 },
        headerClass: "ag-center-cols",
      },
      { headerName: "Employee Name", field: "employeeName", sortable: true },
      {
        headerName: "Invoice Month",
        field: "invoiceMonth",
        sortable: true,
        editable: false,
        enableRowGroup: true,
        valueFormatter: (params) => formatMonthYear(params.value),
      },
      { headerName: "Client", field: "clientName", sortable: true },
      {
        headerName: "Customer",
        field: "customerName",
        sortable: true,
        editable: false,
      },
      {
        headerName: "Bill Rate",
        field: "billRate",
        sortable: true,
        editable: false,
        valueFormatter: (params) => formatCurrency(params.value),
      },

      {
        headerName: "Start Date",
        field: "startDate",
        sortable: true,
        editable: true,
        // Invoice Start Date cannot be before the project's own start date.
        // The picked date snaps to the correct period boundary for this
        // row's Invoice Term (e.g. a Wednesday snaps back to that week's
        // Monday for Weekly), and End Date is recalculated from it —
        // onCellValueChanged below refreshes the End Date cell to reflect it.
        valueSetter: (params) => {
          const { newValue, data } = params;
          if (data.projectStartDate && newValue < data.projectStartDate) {
            alert(
              `Start Date cannot be before the project's start date (${data.projectStartDate}).`,
            );
            return false;
          }
          if (data.projectEndDate && newValue > data.projectEndDate) {
            alert(
              `Start Date cannot be after the project's end date (${data.projectEndDate}).`,
            );
            return false;
          }

          const { startDate, endDate } = computeInvoicePeriod(newValue, data.invoiceTerm, data.weekStartDay);
          data.startDate = startDate || newValue;
          if (endDate) {
            data.endDate =
              data.projectEndDate && endDate > data.projectEndDate ? data.projectEndDate : endDate;
          }
          return true;
        },
        valueFormatter: (params) => formatDateMDY(params.value),
      },
      {
        headerName: "End Date",
        field: "endDate",
        sortable: true,
        editable: true,
        // Invoice End Date cannot be after the project's own end date.
        valueSetter: (params) => {
          const { newValue, data } = params;
          if (data.projectEndDate && newValue > data.projectEndDate) {
            alert(
              `End Date cannot be after the project's end date (${data.projectEndDate}).`,
            );
            return false;
          }
          if (data.projectStartDate && newValue < data.projectStartDate) {
            alert(
              `End Date cannot be before the project's start date (${data.projectStartDate}).`,
            );
            return false;
          }
          data.endDate = newValue;
          return true;
        },
        valueFormatter: (params) => formatDateMDY(params.value),
      },
      { headerName: "Hours", field: "hours", sortable: true, editable: true },
      {
        // Cosmetic/business label the user types — no identity meaning.
        // Whether this period already has an invoice is tracked
        // separately via the row's (non-editable) invoiceId.
        headerName: "Invoice #",
        field: "invoiceNumber",
        sortable: true,
        editable: true,
      },
      {
        headerName: "Total",
        field: "total",
        sortable: true,
        editable: false,
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Timesheet",
        field: "timesheet",
        cellRenderer: (params) => (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AccessTimeIcon />}
            onClick={() => handleOpenTimesheet(params.data)}
          >
            Timesheet
          </Button>
        ),
      },
      {
        headerName: "Actions",
        field: "actions",
        cellRenderer: (params) => (
          <>
            <IconButton color="primary" onClick={() => handleEdit(params)}>
              <EditIcon />
            </IconButton>
          </>
        ),
      },
    ];
    return columns;
  };

  const onCellValueChanged = (params) => {
    console.log(params);
    if (params.column.colId === "hours") {
      const hours = params.data.hours || 0;
      const billRate = params.data.billRate || 0;
      if (hours > 0) {
        setHasUnsavedChanges(true);
      }
      params.data.total = hours * billRate;
      if (params.data.hours > 0 && params.data.invoiceNumber > 0) {
        setInvalidRows((prevInvalidRows) => {
          console.log(prevInvalidRows);
          const updatedInvalidRows = prevInvalidRows.filter(
            (row) => row !== params.data.projectId,
          );
          console.log("Updated Invalid Rows:", updatedInvalidRows);
          return updatedInvalidRows;
        });
      }
      params.api.refreshCells({ rowNodes: [params.node], columns: ["total"] }); // Refresh total column
    }
    console.log(params);
    if (params.column.colId === "invoiceNumber") {
      if (params.data.invoiceNumber > 0) {
        setHasUnsavedChanges(true);
      }
      if (params.data.hours > 0 && params.data.invoiceNumber > 0) {
        console.log(params.data.projectId);
        console.log([...invalidRows]);
        setInvalidRows((prevInvalidRows) => {
          const updatedInvalidRows = prevInvalidRows.filter(
            (row) => row !== params.data.projectId,
          );
          console.log("Updated Invalid Rows:", updatedInvalidRows);
          return updatedInvalidRows;
        });
      }
    }

    if (params.column.colId === "startDate") {
      setHasUnsavedChanges(true);
      // The Start Date valueSetter above may have recalculated End Date as
      // a side effect — AG Grid only auto-refreshes the edited column's own
      // cell, so refresh End Date explicitly to show the new value.
      params.api.refreshCells({ rowNodes: [params.node], columns: ["endDate"] });
    }
  };

  const gridOptions = {
    pagination: true,
    paginationPageSize: 10, // Number of rows to show per page
    domLayout: "autoHeight",
    columnDefs: getColumnsDefList(true, true, true),
    onCellValueChanged: onCellValueChanged,
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const filterData = () => {
    if (!searchText) {
      return rowData;
    }

    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase()),
      ),
    );
  };

  const [open, setOpen] = useState(false);

  const onClose = () => {
    setOpen(false);
  };

  const rowClassRules = {
    "invalid-row": (params) => invalidRows.includes(params.data.projectId), // Highlight rows if their ID is in invalidRows
  };

  // Every period already has an invoice — nothing left to generate. Only
  // fires once the first fetch has actually resolved (hasFetched), so it
  // can't flash on screen during the initial load.
  const isUpToDate = hasFetched && rowData.length === 0;

  return (
    <>
      {month ? (
        <p> Generating Invoice for {month}</p>
      ) : (
        // The employeeId-embedded path (onBack present) never sets month —
        // it's scoped by employee, not by month, so no banner there. The
        // standalone/generic path with no month picked means "every period
        // through today".
        !onBack && <p>Generating Invoice for all months through today</p>
      )}
      <div className="ag-theme-alpine employee-List-grid">
        <Card className="employeeTableCard" style={{ height: "100%" }}>
        {loading ? (
          <div>Loading...</div> // Display loading indicator
        ) : (
          <>
            <GridToolbar className="workforce-search-container">
              {onBack && (
                <>
                  <Button
                    type="default"
                    icon={<ArrowLeftOutlined />}
                    onClick={onBack}
                    style={{ marginRight: "10px" }}
                  >
                    Back
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={onBack}
                    style={{ marginRight: "10px" }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              <Button
                type="default"
                icon={<ReloadOutlined />}
                onClick={fetchData}
                style={{ marginRight: "10px" }}
              >
                Refresh
              </Button>
              <input
                type="text"
                placeholder="Search..."
                value={searchText}
                onChange={handleSearchInputChange}
              />
              {!isUpToDate && (
                <Button key="save" type="primary" onClick={handleSave} disabled={!hasUnsavedChanges}>
                  Save
                </Button>
              )}
            </GridToolbar>

            {isUpToDate ? (
              <Alert
                type="success"
                showIcon
                message={`Invoices for ${employeeName || "this employee"} is up to date`}
                style={{ margin: "10px 0" }}
              />
            ) : (
              <AgGridReact
                enableCellTextSelection={true}
                ensureDomOrder={true}
                ref={gridRef}
                onGridReady={(params) => {
                  gridRef.current = params.api;
                }}
                onSortChanged={(params) => params.api.refreshCells({ force: true })}
                onFilterChanged={(params) => params.api.refreshCells({ force: true })}
                onFirstDataRendered={(params) => {
                  try { params.api.autoSizeAllColumns(); } catch (e) {}
                }}
                autoSizeStrategy={{ type: "fitCellContents" }}
                rowHeight={48}
                rowData={filterData()}
                columnDefs={sizeColumnsForHeader(getColumnsDefList(true))}
                gridOptions={gridOptions}
                defaultColDef={{
                  minWidth: 100,
                  maxWidth: 220,
                  resizable: true,
                  filter: "agSetColumnFilter",
                  enableRowGroup: true,
                  cellClassRules: {
                    darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
                  },
                }}
                sideBar={{
                  toolPanels: [
                    {
                      id: "columns",
                      labelDefault: "Columns",
                      labelKey: "columns",
                      iconKey: "columns",
                      toolPanel: "agColumnsToolPanel",
                      toolPanelParams: {
                        suppressRowGroups: false,
                        suppressValues: true,
                        suppressPivots: false,
                        suppressPivotMode: true,
                        suppressColumnFilter: true,
                        suppressColumnSelectAll: true,
                        suppressColumnExpandAll: true,
                      },
                    },
                  ],
                }}
                rowClassRules={rowClassRules}
                rowGroupPanelShow="always"
                sortable={true}
                pagination={true}
                paginationPageSize={15}
                enableBrowserTooltips={true}
                popupParent={document.body}
              />
            )}

            {isModalOpen && (
              <EditHoursInvoiceModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveModal}
                initialData={editingRowData}
              />
            )}
          </>
        )}
        </Card>
      </div>
    </>
  );
};

export default GenerateInvoiceDetails;
