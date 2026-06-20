// State Management
let releaseNotes = []; // Raw notes from API
let parsedUpdates = []; // Extracted individual updates
let filteredUpdates = []; // After search & category filters
let selectedUpdate = null; // Currently highlighted update
let isUserEditing = false; // Tracks if user manually edited the draft text

let activeFilter = 'all';
let searchQuery = '';
const activeHashtags = new Set(['#BigQuery', '#GoogleCloud']);

// Elements
const refreshBtn = document.getElementById('refreshBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const refreshSpinner = document.getElementById('refreshSpinner');
const syncStatus = document.getElementById('syncStatus');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const feedStats = document.getElementById('feedStats');
const filterTagsContainer = document.getElementById('filterTags');
const feedContainer = document.getElementById('feedContainer');
const initialLoader = document.getElementById('initialLoader');
const feedError = document.getElementById('feedError');
const errorText = document.getElementById('errorText');
const retryBtn = document.getElementById('retryBtn');
const notesList = document.getElementById('notesList');

// Composer Elements
const composerPlaceholder = document.getElementById('composerPlaceholder');
const composerForm = document.getElementById('composerForm');
const selectedBadge = document.getElementById('selectedBadge');
const selectedDate = document.getElementById('selectedDate');
const tweetTextarea = document.getElementById('tweetTextarea');
const charCount = document.getElementById('charCount');
const charProgress = document.getElementById('charProgress');
const resetTweetBtn = document.getElementById('resetTweetBtn');
const hashtagsList = document.getElementById('hashtagsList');
const copyClipboardBtn = document.getElementById('copyClipboardBtn');
const tweetBtn = document.getElementById('tweetBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Circumference of the character limit SVG circle: 2 * PI * r = 2 * PI * 9 ≈ 56.54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 9;

// Init Page
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleaseNotes();
});

// Event Listeners setup
function setupEventListeners() {
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    
    // Search inputs
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        applyFilters();
    });
    
    // Category filters
    filterTagsContainer.addEventListener('click', (e) => {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;
        
        // Update active class
        filterTagsContainer.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        
        activeFilter = tag.dataset.type;
        applyFilters();
    });
    
    // Composer text area inputs
    tweetTextarea.addEventListener('input', (e) => {
        isUserEditing = true;
        updateCharCount(e.target.value.length);
    });
    
    // Reset tweet to default
    resetTweetBtn.addEventListener('click', () => {
        if (!selectedUpdate) return;
        isUserEditing = false;
        generateTweetDraft();
    });
    
    // Hashtags click toggle
    document.querySelectorAll('.hashtag-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const hashtag = tag.dataset.tag;
            if (activeHashtags.has(hashtag)) {
                activeHashtags.delete(hashtag);
                tag.classList.remove('active');
            } else {
                activeHashtags.add(hashtag);
                tag.classList.add('active');
            }
            
            // Regenerate the draft if the user hasn't heavily modified it, or if they click hashtags
            // For a better UX, toggling hashtags will update the composer (and reset isUserEditing to false to apply standard layout)
            isUserEditing = false;
            generateTweetDraft();
        });
    });
    
    // Action Buttons
    exportCsvBtn.addEventListener('click', exportToCSV);
    copyClipboardBtn.addEventListener('click', copyTweetToClipboard);
    tweetBtn.addEventListener('click', postToTwitter);
}

// Fetch notes from backend
async function fetchReleaseNotes() {
    // Show spinner & loading state
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    if (releaseNotes.length === 0) {
        initialLoader.style.display = 'flex';
        feedError.style.display = 'none';
        notesList.style.display = 'none';
    }
    
    try {
        const response = await fetch('/api/release-notes');
        const data = await response.json();
        
        if (data.success) {
            releaseNotes = data.notes;
            processReleaseNotes();
            
            // Update last synced text with current time
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncStatus.textContent = `Synced at ${timeStr}`;
            
            initialLoader.style.display = 'none';
            feedError.style.display = 'none';
            notesList.style.display = 'flex';
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError('Network connectivity failure. Make sure the server is running.');
    } finally {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// Show Error Panel
function showError(msg) {
    initialLoader.style.display = 'none';
    feedError.style.display = 'flex';
    notesList.style.display = 'none';
    errorText.textContent = msg;
}

// Parse HTML contents from Atom feed entries and extract discrete update items
function processReleaseNotes() {
    parsedUpdates = [];
    const parser = new DOMParser();
    
    releaseNotes.forEach(entry => {
        const doc = parser.parseFromString(entry.content || '', 'text/html');
        const children = Array.from(doc.body.children);
        
        if (children.length === 0) {
            // Handle edge case where content is empty
            parsedUpdates.push({
                id: entry.id,
                date: entry.title,
                type: 'Update',
                category: 'Update',
                contentHtml: '<p>No description provided.</p>',
                contentText: 'No details available.',
                link: entry.link
            });
            return;
        }
        
        let currentUpdate = null;
        
        children.forEach(child => {
            // If the element is a heading (standard is H3 inside google feeds for update headers)
            if (child.tagName === 'H3') {
                if (currentUpdate) {
                    parsedUpdates.push(finalizeUpdate(currentUpdate, entry.id));
                }
                currentUpdate = {
                    date: entry.title,
                    type: child.textContent.trim(),
                    htmlParts: [],
                    link: entry.link
                };
            } else {
                if (!currentUpdate) {
                    currentUpdate = {
                        date: entry.title,
                        type: 'Update',
                        htmlParts: [],
                        link: entry.link
                    };
                }
                currentUpdate.htmlParts.push(child.outerHTML);
            }
        });
        
        // Push the last update block for this entry
        if (currentUpdate) {
            parsedUpdates.push(finalizeUpdate(currentUpdate, entry.id));
        }
    });
    
    applyFilters();
}

// Cleans html elements, maps category, and extracts text content
function finalizeUpdate(update, parentId) {
    const contentHtml = update.htmlParts.join('\n');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;
    
    // Formatting tweaks for plaintext translation
    // Replace <li> list elements with bullet points for cleaner tweet formatting
    tempDiv.querySelectorAll('li').forEach(li => {
        li.textContent = `• ${li.textContent}\n`;
    });
    
    let contentText = tempDiv.textContent || tempDiv.innerText || '';
    // Normalize spaces and clean up double spaces/newlines
    contentText = contentText.replace(/\n\s*\n/g, '\n').replace(/\s+/g, ' ').trim();
    
    // Categorize
    const category = getNormalizedCategory(update.type);
    
    // Sub-update unique ID
    const subId = `${parentId}#${update.type.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substr(2, 4)}`;
    
    return {
        id: subId,
        date: update.date,
        type: update.type,
        category: category,
        contentHtml: contentHtml,
        contentText: contentText,
        link: update.link
    };
}

// Maps arbitrary feed headings to standard release note categories
function getNormalizedCategory(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'Feature';
    if (t.includes('announcement')) return 'Announcement';
    if (t.includes('deprecation') || t.includes('deprecat')) return 'Deprecation';
    if (t.includes('fix')) return 'Fix';
    return 'Update';
}

// Filter and render updates
function applyFilters() {
    filteredUpdates = parsedUpdates.filter(update => {
        // Category filter
        const categoryMatch = activeFilter === 'all' || update.category.toLowerCase() === activeFilter;
        
        // Search query filter
        const textMatch = !searchQuery || 
            update.type.toLowerCase().includes(searchQuery) ||
            update.contentText.toLowerCase().includes(searchQuery) ||
            update.date.toLowerCase().includes(searchQuery);
            
        return categoryMatch && textMatch;
    });
    
    // Update count labels
    feedStats.textContent = `Showing ${filteredUpdates.length} update${filteredUpdates.length === 1 ? '' : 's'}`;
    
    renderFeedList();
}

// Render cards
function renderFeedList() {
    notesList.innerHTML = '';
    
    if (filteredUpdates.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No Release Notes Found</h3>
                <p>Try modifying your search keywords or choosing another category filter.</p>
            </div>
        `;
        return;
    }
    
    // Group updates by date
    const groupedByDate = {};
    filteredUpdates.forEach(update => {
        if (!groupedByDate[update.date]) {
            groupedByDate[update.date] = [];
        }
        groupedByDate[update.date].push(update);
    });
    
    // Draw groups
    Object.keys(groupedByDate).forEach(date => {
        const dateBlock = document.createElement('div');
        dateBlock.className = 'date-group';
        
        const dateTitle = document.createElement('h3');
        dateTitle.className = 'date-group-title';
        dateTitle.textContent = date;
        dateBlock.appendChild(dateTitle);
        
        groupedByDate[date].forEach(update => {
            const card = document.createElement('div');
            card.className = `update-card ${selectedUpdate && selectedUpdate.id === update.id ? 'selected' : ''}`;
            card.dataset.id = update.id;
            card.dataset.category = update.category;
            
            const badgeClass = `badge-${update.category.toLowerCase()}`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${update.type}</span>
                    <div class="card-meta">
                        <span class="card-date">${update.date}</span>
                        <button class="card-copy-icon" title="Copy release notes to clipboard" onclick="event.stopPropagation();">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="card-link-icon" title="View official release documentation" onclick="event.stopPropagation();">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                </div>
                <div class="card-body">
                    ${update.contentHtml}
                </div>
            `;
            
            // Card copy to clipboard event
            const cardCopyBtn = card.querySelector('.card-copy-icon');
            if (cardCopyBtn) {
                cardCopyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(update.contentText).then(() => {
                        showToast("Card text copied to clipboard!");
                    }).catch(err => {
                        showToast("Failed to copy card text.");
                    });
                });
            }
            
            // Select event
            card.addEventListener('click', () => selectUpdateCard(update));
            dateBlock.appendChild(card);
        });
        
        notesList.appendChild(dateBlock);
    });
}

// Select note card
function selectUpdateCard(update) {
    selectedUpdate = update;
    isUserEditing = false;
    
    // Update card selection active states in the DOM
    document.querySelectorAll('.update-card').forEach(card => {
        if (card.dataset.id === update.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Open composer sidebar layout
    composerPlaceholder.style.display = 'none';
    composerForm.style.display = 'flex';
    
    // Set static composer fields
    selectedBadge.textContent = update.type;
    selectedBadge.className = `badge badge-${update.category.toLowerCase()}`;
    selectedDate.textContent = update.date;
    
    // Create draft
    generateTweetDraft();
}

// Build Twitter draft text
function generateTweetDraft() {
    if (!selectedUpdate || isUserEditing) return;
    
    let summary = selectedUpdate.contentText;
    
    // Set headers & footers
    const prefix = `[BigQuery ${selectedUpdate.type} • ${selectedUpdate.date}]\n`;
    const detailsLabel = `\n\nRelease details:`;
    const url = selectedUpdate.link;
    const hashTags = Array.from(activeHashtags).join(' ');
    
    // Twitter wraps all URLs to 23 characters for the limit. 
    // We adjust limits considering actual length in local composer text for transparency.
    // Length budgeting: 280 - (prefix) - (detailsLabel) - (url text) - (hashtags text)
    const urlOverhead = url.length; 
    const tagsOverhead = hashTags ? hashTags.length + 2 : 0; // spacing + double newline
    const totalOverhead = prefix.length + detailsLabel.length + urlOverhead + tagsOverhead;
    
    const maxContentTextLen = 280 - totalOverhead;
    
    if (summary.length > maxContentTextLen && maxContentTextLen > 10) {
        summary = summary.substring(0, maxContentTextLen - 3).trim() + '...';
    }
    
    const draftText = `${prefix}${summary}${detailsLabel} ${url}${hashTags ? '\n\n' + hashTags : ''}`;
    
    tweetTextarea.value = draftText;
    updateCharCount(draftText.length);
}

// Manage dynamic circular character counts
function updateCharCount(length) {
    charCount.textContent = length;
    
    const wrapper = charCount.parentElement;
    
    // Calculate color status & circle filling
    // If over 280, progress holds at 100%, circle turns red
    const limit = 280;
    const percentage = Math.min((length / limit) * 100, 100);
    const strokeOffset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
    
    charProgress.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    charProgress.style.strokeDashoffset = strokeOffset;
    
    // Color updates
    if (length > limit) {
        wrapper.className = 'char-count-wrapper danger';
        charProgress.style.stroke = 'var(--color-fix)'; // Red
    } else if (length >= 260) {
        wrapper.className = 'char-count-wrapper warning';
        charProgress.style.stroke = 'var(--color-deprecation)'; // Yellow
    } else {
        wrapper.className = 'char-count-wrapper';
        charProgress.style.stroke = 'var(--color-primary)'; // Blue
    }
}

// Copy to clipboard
function copyTweetToClipboard() {
    const textToCopy = tweetTextarea.value;
    if (!textToCopy) return;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Draft copied to clipboard!");
    }).catch(err => {
        showToast("Failed to copy text. Please select and copy manually.");
    });
}

// Share on Twitter Web Intent
function postToTwitter() {
    const text = tweetTextarea.value;
    if (!text) return;
    
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400,resizable=yes');
}

// Show custom toast message
let toastTimeout;
function showToast(msg) {
    clearTimeout(toastTimeout);
    toastMessage.textContent = msg;
    toast.classList.add('show');
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Export filtered release notes list to CSV format
function exportToCSV() {
    if (filteredUpdates.length === 0) {
        showToast("No updates available to export.");
        return;
    }
    
    // CSV Header row
    const headers = ['Date', 'Type', 'Category', 'Plaintext Content', 'Source Link'];
    
    // Helper to safely escape quotes, newlines and commas
    const escapeCSV = (str) => {
        if (str === null || str === undefined) return '';
        // Escape existing quotes with double quotes
        const formatted = str.toString().replace(/"/g, '""');
        return `"${formatted}"`;
    };
    
    const rows = filteredUpdates.map(update => [
        escapeCSV(update.date),
        escapeCSV(update.type),
        escapeCSV(update.category),
        escapeCSV(update.contentText),
        escapeCSV(update.link)
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Dynamic download link generation
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Use current date for filename
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `bigquery_release_notes_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV export completed successfully!");
}
