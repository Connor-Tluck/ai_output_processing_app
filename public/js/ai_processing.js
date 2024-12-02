// This script does select specific template emails based on the user, it would be more expensive but give far more control.
// Of the email outputs themselves and how they are targeting each industry. 


// Event Listener for AI Process Button
document.getElementById('aiProcessBtn').addEventListener('click', () => {
    console.log('AI Process initiated for the current table data.');
    const modal = new bootstrap.Modal(document.getElementById('aiProcessModal')); // AI Processing Options modal
    modal.show();
});

// Handle "Process All Rows" and "Process Unmodified Rows"
document.getElementById('processAllRowsBtn').addEventListener('click', async () => {
    closeModal(); // Close AI Processing Options modal
    disableProcessingButtons(true); // Disable buttons to avoid multiple clicks
    showProcessingProgressModal(); // Show progress modal
    await processRows('all'); // Process all rows
    closeProcessingProgressModal(); // Hide progress modal
    disableProcessingButtons(false); // Re-enable buttons
});

document.getElementById('processUnmodifiedRowsBtn').addEventListener('click', async () => {
    closeModal(); // Close AI Processing Options modal
    disableProcessingButtons(true); // Disable buttons to avoid multiple clicks
    showProcessingProgressModal(); // Show progress modal
    await processRows('unmodified'); // Process only unmodified rows
    closeProcessingProgressModal(); // Hide progress modal
    disableProcessingButtons(false); // Re-enable buttons
});

// Function to close the AI Processing Options modal
function closeModal() {
    const modalElement = document.getElementById('aiProcessModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide();
    }
}

function showProcessingProgressModal() {
    const progressModalElement = document.getElementById('processingProgressModal');
    if (!progressModalElement) {
        console.error('Processing Progress Modal not found!');
        return;
    }

    const progressModal = new bootstrap.Modal(progressModalElement, {
        backdrop: 'static',
        keyboard: false,
    });
    progressModal.show();
    updateProgressBar(0, 'Initializing...');
}

function closeProcessingProgressModal() {
    const progressModalElement = document.getElementById('processingProgressModal');
    if (!progressModalElement) {
        console.error('Processing Progress Modal not found!');
        return;
    }

    const progressModal = bootstrap.Modal.getInstance(progressModalElement);
    if (progressModal) {
        progressModal.hide();
    }
}


// Function to update the progress bar in the progress modal
function updateProgressBar(percent, status) {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('processingStatus');
    if (progressBar && statusText) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        progressBar.textContent = `${percent}%`;
        statusText.textContent = status;
    }
}

// Function to disable the processing buttons to avoid multiple clicks
function disableProcessingButtons(disable) {
    const processAllBtn = document.getElementById('processAllRowsBtn');
    const processUnmodifiedBtn = document.getElementById('processUnmodifiedRowsBtn');
    processAllBtn.disabled = disable;
    processUnmodifiedBtn.disabled = disable;
}

// Function to display errors in a modal
function showErrorModal(message) {
    const errorModalElement = document.getElementById('errorModal');
    const errorModalMessage = document.getElementById('errorModalMessage');
    if (errorModalElement && errorModalMessage) {
        errorModalMessage.textContent = message;
        const errorModal = new bootstrap.Modal(errorModalElement);
        errorModal.show();
    }
}

// Main function to process rows
async function processRows(option) {
    if (!globalData || globalData.length === 0) {
        showErrorModal('No data available to process!');
        return;
    }

    // Load the email templates
    const emailTemplates = await fetch('/Template_Information/nearmap_email_templates.json')
        .then(response => response.json())
        .catch(error => {
            console.error('Error loading email templates:', error);
            showErrorModal('Failed to load email templates.');
            return null;
        });

    if (!emailTemplates || !emailTemplates.email_templates) {
        showErrorModal('No email templates found!');
        return;
    }

    const logEntries = []; // Array to store log entries
    const totalRows = globalData.length;
    let processedRows = 0;
    const batchSize = 5; // Number of rows per batch

    const processBatch = async (batch) => {
        const requests = batch.map(async (row) => {
            // Skip rows if processing only unmodified rows
            if (option === 'unmodified' && row.email_status !== 'No Email Set') {
                return null; // Skip processing
            }

            // Extract the list of industries from the templates
            const industries = emailTemplates.email_templates.map(template => template.industry);

            // First API Call: Determine the most relevant industry
            const industrySelectionPrompt = `
                Given the following contact details, determine the most relevant industry:
                - Name: ${row.target_name}
                - Company: ${row.company}
                - Role: ${row.role}

                Industries:
                ${industries.join(', ')}

                Respond with the industry name that is the best match.
            `;

            let selectedIndustry;
            try {
                const selectionResponse = await fetch('/ai_processing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: industrySelectionPrompt }),
                });
                const selectionResult = await selectionResponse.json();
                selectedIndustry = selectionResult.text?.trim();
                console.log(`Selected industry for ${row.target_name}: ${selectedIndustry}`);
            } catch (error) {
                console.error(`Error selecting industry for ${row.target_name}:`, error);
                selectedIndustry = null; // Fallback to default
            }

            if (!selectedIndustry) {
                console.warn(`Failed to select an industry for ${row.target_name}, defaulting to the first template.`);
                selectedIndustry = industries[0]; // Default to the first template industry
            }

            // Match the selected industry to a template
            const matchingTemplate = emailTemplates.email_templates.find(
                template => template.industry.toLowerCase() === selectedIndustry.toLowerCase()
            ) || emailTemplates.email_templates[0]; // Default to the first template if no match

            // Log the selected industry
            logEntries.push(`Contact: ${row.target_name} (${row.company})\nSelected Industry: ${selectedIndustry}\n`);

            // Construct the AI prompt for email generation
            const aiEmailGenerationPrompt = `
                Write a personalized email for the following contact details:
                - Name: ${row.target_name}
                - Company: ${row.company}
                - Role: ${row.role}
                - Email Purpose: ${matchingTemplate.template.subject}
                
                Use this template as a reference:
                Subject: ${matchingTemplate.template.subject}
                Greeting: ${matchingTemplate.template.body.greeting}
                Introduction: ${matchingTemplate.template.body.intro}
                Features: ${matchingTemplate.template.body.features.join(', ')}
                Value Proposition: ${matchingTemplate.template.body.value_proposition}
                Call to Action: ${matchingTemplate.template.body.call_to_action}
                Closing: ${matchingTemplate.template.body.closing}
                
                Make the email sound personal, direct, and focused on helping them solve their specific business problems.
            `;

            // Second API Call: Generate the email
            try {
                const generationResponse = await fetch('/ai_processing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: aiEmailGenerationPrompt }),
                });
                const generatedEmail = await generationResponse.json();

                if (generatedEmail && generatedEmail.text) {
                    row.email_draft = generatedEmail.text;
                    row.email_status = 'AI Processed';

                    // Add log entry
                    logEntries.push(`Email Generation Input:\n${aiEmailGenerationPrompt}\nOutput:\n${generatedEmail.text}\n`);

                    // Update the database (if using SQLite)
                    db.run(`UPDATE clients SET email_draft = ?, email_status = ? WHERE target_name = ?`, [
                        generatedEmail.text,
                        'AI Processed',
                        row.target_name,
                    ]);

                    console.log(`Generated email for ${row.target_name}:`, generatedEmail.text);
                } else {
                    console.warn(`Failed to generate email for ${row.target_name}`);
                }
            } catch (error) {
                console.error(`Error generating email for ${row.target_name}:`, error);
                showErrorModal(`Error processing ${row.target_name}: ${error.message}`);
            }

            processedRows++;
            updateProgressBar(
                Math.round((processedRows / totalRows) * 100),
                `Processing ${row.target_name} (${row.company})`
            );
        });

        await Promise.all(requests);
    };

    // Split rows into batches and process them
    for (let i = 0; i < totalRows; i += batchSize) {
        const batch = globalData.slice(i, i + batchSize);
        await processBatch(batch);
    }

    // Update progress bar to 100% when complete
    updateProgressBar(100, 'Processing complete!');

    // Write logs to a file
    const logBlob = new Blob([logEntries.join('\n\n')], { type: 'text/plain' });
    const logURL = URL.createObjectURL(logBlob);
    const logLink = document.createElement('a');
    logLink.href = logURL;
    logLink.setAttribute('download', 'log.txt');
    logLink.click();

    // Refresh the table to display updated email drafts and statuses
    populateTable(globalData);
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    successModal.show();
}


// Update the table row styling
function populateTable(data) {
    const clientTable = document.getElementById('clientTable').querySelector('tbody');
    clientTable.innerHTML = ''; // Clear existing rows

    if (data.length === 0) {
        clientTable.innerHTML = '<tr><td colspan="8" class="text-center">No data available</td></tr>';
        return;
    }

    data.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.classList.add('table-row');

        // Determine the button style based on email status
        const emailStatusClass =
            row.email_status === 'AI Processed' ? 'btn-warning' :
            row.email_status === 'User Modified' ? 'btn-success' : 'btn-secondary';

        tr.innerHTML = `
            <td><button class="btn btn-sm btn-outline-primary" onclick="selectCustomer(${index}, this)">Select</button></td>
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
