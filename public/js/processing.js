// Event Listener for Export Button
document.getElementById('exportBtn').addEventListener('click', () => {
    exportTableToCSV(globalData, 'exported_table.csv');
  });
  
  // Event Listener for AI Process Button
  document.getElementById('aiProcessBtn').addEventListener('click', () => {
    console.log('AI Process initiated for the current table data.');
    // Placeholder logic for AI Process
    alert('AI Processing started!');
  });
  
  // Export Function
  function exportTableToCSV(data, filename) {
    if (!data || data.length === 0) {
      alert('No data available to export!');
      return;
    }
  
    // Convert data to CSV format
    const headers = [
      'Target Name',
      'Company',
      'Role',
      'Sales Stage',
      'Current Customer',
      'Current ACV',
      'Email Status',
      'Email Draft',
    ];
    const rows = data.map(row => [
      row.target_name,
      row.company,
      row.role,
      row.sales_stage,
      row.current_customer,
      row.current_acv,
      row.email_status,
      db
        .exec(`SELECT email_draft FROM clients WHERE target_name = ?`, [
          row.target_name,
        ])[0]?.values[0][0] || '',
    ]);
  
    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(item => `"${item}"`).join(',')) // Escape values with quotes
      .join('\n');
  
    // Create a blob and download it
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('CSV export completed.');
  }
  