import React, { useEffect, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Input, Select, message, Popconfirm } from "antd";
import { ReloadOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { ROLES } from "../Utils/roleAccess";
import { formatDateMDY } from "../Utils/dateFormat";

const ROLE_OPTIONS = Object.values(ROLES);

// Admin-only page (see roleAccess.js ROUTE_ROLES["/userAccess"]) for
// assigning who gets which role — the actual "give access" UI referenced in
// the role-based-access-control plan. Backed by UserRoleController in the
// backend, which isn't itself role-gated (frontend-only enforcement for
// now), so this page being hidden from non-Admins in the nav/route gate is
// the only thing keeping it Admin-only today.
const UserRoles = () => {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState(ROLES.HR);
  const [adding, setAdding] = useState(false);

  const fetchData = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getAllUserRoles)
      .then((response) => setRowData(response.data || []))
      .catch((error) => {
        console.error("Error fetching user roles:", error);
        message.error("Failed to load user roles.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = (params) => {
    const { email, role } = params.data;
    axios
      .put(API_ENDPOINTS.upsertUserRole, { email, role })
      .then(() => message.success(`Updated ${email} to ${role}.`))
      .catch((error) => {
        console.error("Error updating role:", error);
        message.error("Failed to update role.");
        fetchData();
      });
  };

  const handleDelete = (email) => {
    axios
      .delete(API_ENDPOINTS.deleteUserRole(email))
      .then(() => {
        message.success(`Removed access for ${email}.`);
        fetchData();
      })
      .catch((error) => {
        console.error("Error removing user role:", error);
        message.error("Failed to remove access.");
      });
  };

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      message.error("Enter a valid email address.");
      return;
    }
    setAdding(true);
    axios
      .put(API_ENDPOINTS.upsertUserRole, { email, role: newRole })
      .then(() => {
        message.success(`Granted ${newRole} access to ${email}.`);
        setNewEmail("");
        fetchData();
      })
      .catch((error) => {
        console.error("Error adding user role:", error);
        message.error("Failed to add user.");
      })
      .finally(() => setAdding(false));
  };

  const columnDefs = [
    { field: "email", headerName: "Email", flex: 2, minWidth: 220 },
    {
      field: "role",
      headerName: "Role",
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ROLE_OPTIONS },
    },
    { field: "lastUpdated", headerName: "Last Updated", flex: 1, minWidth: 140, valueFormatter: (params) => formatDateMDY(params.value) },
    {
      headerName: "",
      width: 90,
      cellRenderer: (params) => (
        <Popconfirm
          title={`Remove access for ${params.data.email}?`}
          onConfirm={() => handleDelete(params.data.email)}
        >
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input
            placeholder="email@intellanit.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ width: 260 }}
          />
          <Select value={newRole} onChange={setNewRole} style={{ width: 160 }} options={ROLE_OPTIONS.map((r) => ({ value: r, label: r }))} />
          <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={handleAdd}>
            Grant Access
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ marginLeft: "auto" }}>
            Refresh
          </Button>
        </div>
      </Card>

      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          ref={gridRef}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          rowData={rowData}
          columnDefs={columnDefs}
          loading={loading}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          onCellValueChanged={handleRoleChange}
          defaultColDef={{ resizable: true, sortable: true, filter: true }}
        />
      </div>
    </div>
  );
};

export default UserRoles;
