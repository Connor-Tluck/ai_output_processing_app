let db; // SQLite database instance
let selectedCustomerId = null; // Track the currently selected customer
let globalData = []; // Store the entire dataset in memory for filtering
const csvUpload = document.getElementById('csvUpload');
const clientTable = document.getElementById('clientTable').querySelector('tbody');
const companyFilter = document.getElementById('companyFilter');
const emailDraftViewer = document.getElementById('emailDraftViewer');
const selectedContactInfo = document.getElementById('selectedContactInfo'); // Placeholder for selected contact details
const selectedEmailStatus = document.getElementById('selectedEmailStatus'); // Placeholder for selected contact details

// Initialize SQLite database
async function initDatabase() {
  const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
  db = new SQL.Database();
  db.run(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_name TEXT,
      company TEXT,
      role TEXT,
      sales_stage TEXT,
      current_customer TEXT,
      current_acv INTEGER,
      email_draft TEXT DEFAULT '',
      email_status TEXT DEFAULT 'No Email Set'
    );
  `);
  console.log('Database initialized');
}

// Handle CSV Upload
csvUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('CSV Upload Complete:', results.data);
        globalData = results.data.map(row => ({
          target_name: row['Target Name']?.trim() || '',
          company: row['Company']?.trim() || '',
          role: row['Role']?.trim() || '',
          sales_stage: row['Sales Stage']?.trim() || '',
          current_customer: row['Current Customer']?.trim() || '',
          current_acv: parseInt(row['Current ACV']) || 0,
          email_status: 'No Email Set'
        }));
        insertDataIntoDatabase(globalData);
        populateTable(globalData); // Populate the table initially with all data
        populateCompanyFilter(); // Populate the filter dropdown
      },
      error: (err) => console.error('Error parsing CSV:', err),
    });
  }
});

// Insert data into SQLite database
function insertDataIntoDatabase(data) {
  db.run('DELETE FROM clients'); // Clear existing data
  const stmt = db.prepare(`
    INSERT INTO clients (
      target_name, company, role, sales_stage, current_customer,
      current_acv, email_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  data.forEach(row => {
    stmt.run([
      row.target_name,
      row.company,
      row.role,
      row.sales_stage,
      row.current_customer,
      row.current_acv,
      row.email_status
    ]);
  });
  stmt.free();
  console.log('Data inserted into database.');
}

// Populate Table with Filtered Data
function populateTable(data) {
  clientTable.innerHTML = ''; // Clear existing rows

  if (data.length === 0) {
    clientTable.innerHTML = '<tr><td colspan="8" class="text-center">No data available</td></tr>';
    return;
  }

  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.classList.add('table-row');
    if (index === selectedCustomerId) {
      tr.classList.add('table-active'); // Highlight selected row
    }

    // Determine the button style based on email status
    let emailStatusClass;
    switch (row.email_status) {
      case 'User Modified':
        emailStatusClass = 'btn-success';
        break;
      case 'Automatic':
        emailStatusClass = 'btn-warning';
        break;
      default:
        emailStatusClass = 'btn-secondary';
        break;
    }

    tr.innerHTML = `
      <td><button class="btn btn-sm ${index === selectedCustomerId ? 'btn-primary' : 'btn-outline-primary'}" onclick="selectCustomer(${index}, this)">Select</button></td>
      <td>${row.target_name}</td>
      <td>${row.company}</td>
      <td>${row.role}</td>
      <td>${row.sales_stage}</td>
      <td>${row.current_customer}</td>
      <td>${row.current_acv}</td>
      <td><button class="btn ${emailStatusClass} btn-sm">${row.email_status}</button></td>
    `;
    clientTable.appendChild(tr);
  });
}

function selectCustomer(index, button) {
  selectedCustomerId = index;

  // Highlight the selected button and row
  const rows = document.querySelectorAll('.table-row');
  rows.forEach(row => row.classList.remove('table-active'));

  const buttons = document.querySelectorAll('#clientTable .btn');
  buttons.forEach(btn => btn.classList.replace('btn-primary', 'btn-outline-primary'));

  button.classList.replace('btn-outline-primary', 'btn-primary');
  button.closest('tr').classList.add('table-active');

  // Load email draft and selected contact details into the viewer
  const selectedRow = globalData[index];
  const result = db.exec(`SELECT email_draft, email_status FROM clients WHERE target_name = ?`, [selectedRow.target_name]);
  emailDraftViewer.value = result[0]?.values[0][0] || '';
  selectedRow.email_status = result[0]?.values[0][1] || 'No Email Set';

  // Update selected contact details
  document.getElementById('selectedContact').textContent = selectedRow.target_name;
  document.getElementById('selectedCompany').textContent = selectedRow.company;
  document.getElementById('selectedEmailStatus').textContent = selectedRow.email_status;


  // Update Email Status Badge
  const emailStatusBadge = document.getElementById('emailStatusBadge');
  emailStatusBadge.textContent = selectedRow.email_status;

  // Apply appropriate badge class
  switch (selectedRow.email_status) {
    case 'User Modified':
      emailStatusBadge.className = 'badge badge-success';
      break;
    case 'Automatic':
      emailStatusBadge.className = 'badge badge-warning';
      break;
    default:
      emailStatusBadge.className = 'badge badge-secondary';
      break;
  }

  console.log(`Selected customer: ${selectedRow.target_name}`);
}

// Auto-save the edited email draft and dynamically update the Email Status UI
emailDraftViewer.addEventListener('input', () => {
  if (selectedCustomerId === null) return;

  const emailDraft = emailDraftViewer.value;
  const selectedRow = globalData[selectedCustomerId];

  // Update the email status to "User Modified" if the text is changed
  const emailStatus = emailDraft.trim() ? 'User Modified' : 'No Email Set';
  selectedRow.email_status = emailStatus;

  // Update the database
  db.run(`UPDATE clients SET email_draft = ?, email_status = ? WHERE target_name = ?`, [
    emailDraft,
    emailStatus,
    selectedRow.target_name
  ]);

  // Update the Email Status badge dynamically
  const emailStatusBadge = document.getElementById('emailStatusBadge');
  emailStatusBadge.textContent = emailStatus;

  // Apply appropriate badge class
  switch (emailStatus) {
    case 'User Modified':
      emailStatusBadge.className = 'badge badge-success';
      break;
    case 'Automatic':
      emailStatusBadge.className = 'badge badge-warning';
      break;
    default:
      emailStatusBadge.className = 'badge badge-secondary';
      break;
  }

  // Update the table row to reflect the new email status
  populateTable(globalData);

  console.log(`Auto-saved email draft for customer: ${selectedRow.target_name}, Status: ${emailStatus}`);
});

// Auto-save the edited email draft and dynamically update the Email Status UI
emailDraftViewer.addEventListener('input', () => {
  if (selectedCustomerId === null) return;

  const emailDraft = emailDraftViewer.value;
  const selectedRow = globalData[selectedCustomerId];

  // Update the email status to "User Modified" if the text is changed
  const emailStatus = emailDraft.trim() ? 'User Modified' : 'No Email Set';
  selectedRow.email_status = emailStatus;

  // Update the database
  db.run(`UPDATE clients SET email_draft = ?, email_status = ? WHERE target_name = ?`, [
    emailDraft,
    emailStatus,
    selectedRow.target_name
  ]);

  // Update the Email Status badge dynamically
  const emailStatusBadge = document.getElementById('emailStatusBadge');
  emailStatusBadge.textContent = emailStatus;

  // Apply appropriate badge class
  switch (emailStatus) {
    case 'User Modified':
      emailStatusBadge.className = 'badge badge-success';
      break;
    case 'Automatic':
      emailStatusBadge.className = 'badge badge-warning';
      break;
    default:
      emailStatusBadge.className = 'badge badge-secondary';
      break;
  }

  // Update the table row to reflect the new email status
  populateTable(globalData);

  console.log(`Auto-saved email draft for customer: ${selectedRow.target_name}, Status: ${emailStatus}`);
});



// Auto-save the edited email draft and update the email status dynamically
emailDraftViewer.addEventListener('input', () => {
  if (selectedCustomerId === null) return;

  const emailDraft = emailDraftViewer.value;
  const selectedRow = globalData[selectedCustomerId];

  // Update the email status to "User Modified" if the text is changed
  const emailStatus = emailDraft.trim() ? 'User Modified' : 'No Email Set';
  selectedRow.email_status = emailStatus;

  // Update the database
  db.run(`UPDATE clients SET email_draft = ?, email_status = ? WHERE target_name = ?`, [
    emailDraft,
    emailStatus,
    selectedRow.target_name
  ]);

  // Update the Email Status display in the selected contact info
  document.getElementById('emailStatus').textContent = emailStatus;

  // Update the table row to reflect the new email status
  populateTable(globalData);

  console.log(`Auto-saved email draft for customer: ${selectedRow.target_name}, Status: ${emailStatus}`);
});


// Populate Company Filter
function populateCompanyFilter() {
  const companies = [...new Set(globalData.map(row => row.company).filter(Boolean))].sort();
  companyFilter.innerHTML = '<option value="">All Companies</option>'; // Default option to reset filter
  companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company;
    option.textContent = company;
    companyFilter.appendChild(option);
  });
  console.log('Company filter populated.');
}

// Filter Table by Company
companyFilter.addEventListener('change', () => {
  const selectedCompany = companyFilter.value;
  console.log(`Filtering by company: ${selectedCompany}`);
  const filteredData = selectedCompany
    ? globalData.filter(row => row.company === selectedCompany)
    : globalData;
  populateTable(filteredData);
});

// Initialize the database on page load
initDatabase();
