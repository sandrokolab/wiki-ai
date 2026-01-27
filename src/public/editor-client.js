(function () {
    // DOM Elements - Using let and checking for existence
    const getEl = (id) => document.getElementById(id);

    const titleInput = getEl('title');
    const slugInput = getEl('slug');
    const slugPreview = getEl('slugPreviewValue');
    const editSlugBtn = getEl('editSlugBtn');
    const tagInput = getEl('tagInput');
    const tagsContainer = getEl('tagsContainer');
    const hiddenCategoryInput = getEl('category');
    const contentTextarea = getEl('content');
    const charCount = getEl('charCount');
    const readTime = getEl('readTime');
    const advancedOptionsBtn = getEl('advancedOptionsBtn');
    const optionsContent = getEl('optionsContent');
    const unsavedIndicator = getEl('unsavedIndicator');
    const draftStatus = getEl('draftStatus');
    const topicSelect = getEl('topic_id');
    const pageId = getEl('pageId')?.value;
    const versionList = getEl('versionList');
    const editorForm = getEl('editorForm');
    const commitModal = getEl('commitModal');
    const submitStatusInput = getEl('submitStatus');
    const changeSummary = getEl('changeSummary');

    let tags = [];
    let isDirty = false;

    // --- Configuration ---
    const AUTO_SAVE_INTERVAL = 30000;

    // --- Helpers ---
    function slugify(text) {
        return text.toString().toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    }

    function updateStats() {
        const text = contentTextarea.value;
        const count = text.length;
        charCount.textContent = `${count.toLocaleString()} characters`;
        const words = text.trim().split(/\s+/).length;
        const minutes = Math.ceil(words / 200);
        readTime.textContent = count > 0 ? `~${minutes} min read` : '';
    }

    function setDirty() {
        isDirty = true;
        if (unsavedIndicator) unsavedIndicator.style.display = 'block';
        updateUnsavedItem();
    }

    function clearDirty() {
        isDirty = false;
        if (unsavedIndicator) unsavedIndicator.style.display = 'none';
        updateUnsavedItem();
    }

    // --- History Logic ---
    async function fetchHistory() {
        if (!pageId) return;
        try {
            const res = await fetch(`/w/${window.wikiContext.slug}/api/wiki/${pageId}/history`);
            const revisions = await res.json();
            renderHistory(revisions);
        } catch (err) {
            console.error('Failed to fetch history', err);
        }
    }

    function renderHistory(revisions) {
        if (!versionList) return;
        versionList.innerHTML = '';

        // Add "Unsaved changes" or "Current" item at top
        const currentItem = document.createElement('div');
        currentItem.id = 'unsavedItem';
        currentItem.className = `version-item ${isDirty ? 'unsaved' : 'current'}`;
        currentItem.innerHTML = `
            <div class="version-meta">
                <span class="version-indicator"></span>
                <span class="version-number">${isDirty ? 'Unsaved changes' : 'Current version'}</span>
                <span class="version-time">${isDirty ? 'Editing now' : 'Just now'}</span>
            </div>
            <div class="version-author">You</div>
            ${isDirty ? '<button type="button" class="btn-version-action" onclick="discardChanges()">Discard changes</button>' : ''}
        `;
        versionList.appendChild(currentItem);

        if (revisions.length === 0 && !isDirty) {
            versionList.innerHTML += `
                <div class="version-placeholder" style="padding: 20px; text-align: center;">
                    <p style="font-size: 0.75rem; color: var(--text-secondary);">No history yet.</p>
                </div>
            `;
            return;
        }

        revisions.forEach((rev, idx) => {
            const date = new Date(rev.created_at);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('div');
            item.className = 'version-item previous';
            item.innerHTML = `
                <div class="version-meta">
                    <span class="version-indicator"></span>
                    <span class="version-number">Version ${revisions.length - idx}</span>
                    <span class="version-time">${timeStr}</span>
                </div>
                <div class="version-author">
                    <div class="avatar-xs">${rev.username.charAt(0).toUpperCase()}</div>
                    ${rev.username}
                </div>
                ${rev.change_summary ? `<div class="version-summary">${rev.change_summary}</div>` : ''}
                <div class="version-actions">
                    <button type="button" class="btn-version-action" onclick="previewVersion(${rev.id})">View</button>
                    <button type="button" class="btn-version-action" onclick="confirmRestore(${rev.id})">Restore</button>
                </div>
            `;
            versionList.appendChild(item);
        });
    }

    function updateUnsavedItem() {
        if (!versionList) return;
        const unsaved = document.getElementById('unsavedItem');
        if (unsaved) {
            unsaved.className = `version-item ${isDirty ? 'unsaved' : 'current'}`;
            unsaved.querySelector('.version-number').textContent = isDirty ? 'Unsaved changes' : 'Current version';
            unsaved.querySelector('.version-time').textContent = isDirty ? 'Editing now' : 'Just now';
            // Update button or clear it
            const existingBtn = unsaved.querySelector('button');
            if (isDirty && !existingBtn) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-version-action';
                btn.textContent = 'Discard changes';
                btn.onclick = discardChanges;
                unsaved.appendChild(btn);
            } else if (!isDirty && existingBtn) {
                existingBtn.remove();
            }
        } else {
            fetchHistory(); // Re-render all if missing
        }
    }

    window.discardChanges = function () {
        if (confirm('Are you sure you want to discard all unsaved changes?')) {
            location.reload();
        }
    };

    window.previewVersion = async function (id) {
        try {
            const res = await fetch(`/w/${window.wikiContext.slug}/api/wiki/revision/${id}`);
            const rev = await res.json();

            document.getElementById('previewVersionTitle').textContent = `Version Details`;
            document.getElementById('previewMeta').innerHTML = `
                By <strong>${rev.username}</strong> on ${new Date(rev.created_at).toLocaleString()}<br>
                ${rev.change_summary ? `Summary: <em>"${rev.change_summary}"</em>` : ''}
            `;
            document.getElementById('previewBody').innerHTML = marked.parse(rev.content);
            document.getElementById('versionPreviewModal').style.display = 'block';

            document.getElementById('restoreBtn').onclick = () => confirmRestore(rev.id);
        } catch (err) {
            alert('Failed to load version');
        }
    };

    window.confirmRestore = async function (id) {
        if (confirm('This will replace your current content in the editor. Continue?')) {
            try {
                const res = await fetch(`/w/${window.wikiContext.slug}/api/wiki/revision/${id}`);
                const rev = await res.json();
                contentTextarea.value = rev.content;
                updateStats();
                setDirty();
                closeVersionPreview();
                alert('Content restored. Remember to save your changes.');
            } catch (err) {
                alert('Failed to restore version');
            }
        }
    };

    function toggleMobileHistory() {
        const versionCol = document.getElementById('versionCol');
        if (versionCol) {
            versionCol.classList.toggle('show');
        }
    }

    window.closeVersionPreview = function () {
        document.getElementById('versionPreviewModal').style.display = 'none';
    };

    function closeCommitModal() {
        if (commitModal) commitModal.style.display = 'none';
    }

    // Export internal functions if needed or handle internally
    function showCommitModal(status) {
        if (submitStatusInput) {
            submitStatusInput.value = status;
        } else {
            console.error('submitStatusInput NOT FOUND in showCommitModal');
        }

        if (commitModal) {
            commitModal.style.display = 'block';
        } else {
            console.error('commitModal NOT FOUND in showCommitModal');
        }
    }

    // --- Slug Logic ---
    let manualSlug = false;
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            if (!manualSlug && slugInput && slugPreview) {
                const slug = slugify(titleInput.value);
                slugInput.value = slug;
                slugPreview.textContent = slug || '[slug]';
            }
            setDirty();
        });
    }

    if (slugInput) {
        slugInput.addEventListener('input', () => {
            manualSlug = true;
            slugInput.value = slugify(slugInput.value);
            if (slugPreview) slugPreview.textContent = slugInput.value || '[slug]';
            setDirty();
        });
    }

    if (editSlugBtn) {
        editSlugBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (slugInput) slugInput.parentElement.style.display = 'block';
            editSlugBtn.style.display = 'none';
        });
    }

    // --- Tag System ---
    function renderTags() {
        if (!tagsContainer || !tagInput) return;
        const existingPills = tagsContainer.querySelectorAll('.tag-pill');
        existingPills.forEach(p => p.remove());
        tags.forEach((tag, index) => {
            const pill = document.createElement('div');
            pill.className = 'tag-pill';
            pill.innerHTML = `<span>${tag}</span><button type="button" data-index="${index}">&times;</button>`;
            tagsContainer.insertBefore(pill, tagInput);
        });
        if (hiddenCategoryInput) hiddenCategoryInput.value = tags.join(', ');
    }

    if (tagInput) {
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = tagInput.value.trim().replace(/,/g, '');
                if (val && !tags.includes(val)) {
                    tags.push(val);
                    renderTags();
                    tagInput.value = '';
                    setDirty();
                }
            }
        });
    }

    // --- Editor Logic ---
    if (contentTextarea) {
        contentTextarea.addEventListener('input', () => {
            updateStats();
            setDirty();
        });
    }

    // Toolbar Formatting
    function insertFormatting(type) {
        if (!contentTextarea) return;
        const start = contentTextarea.selectionStart;
        const end = contentTextarea.selectionEnd;
        const text = contentTextarea.value;
        const selected = text.substring(start, end);
        let rep = '';

        switch (type) {
            case 'bold': rep = `**${selected || 'bold text'}**`; break;
            case 'italic': rep = `*${selected || 'italic text'}*`; break;
            case 'quote': rep = `\n> ${selected || 'quote'}`; break;
            case 'h1': rep = `\n# ${selected || 'Heading 1'}`; break;
            case 'h2': rep = `\n## ${selected || 'Heading 2'}`; break;
            case 'list-bullet': rep = `\n- ${selected || 'item'}`; break;
            case 'list-number': rep = `\n1. ${selected || 'item'}`; break;
            case 'check': rep = `\n- [ ] ${selected || 'task'}`; break;
            case 'link': rep = `[${selected || 'link text'}](https://example.com)`; break;
            case 'image': rep = `![${selected || 'alt text'}](https://example.com/image.jpg)`; break;
            case 'code': rep = `\`${selected || 'code'}\``; break;
        }

        contentTextarea.value = text.substring(0, start) + rep + text.substring(end);
        updateStats();
        setDirty();
        contentTextarea.focus();
    }

    // --- Advanced Options ---
    advancedOptionsBtn?.addEventListener('click', () => {
        optionsContent.classList.toggle('show');
    });

    // Topic Selection
    if (topicSelect) {
        topicSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new') {
                if (typeof openTopicModal === 'function') {
                    openTopicModal();
                    e.target.value = '';
                }
            }
        });
    }

    // Unsaved Warning
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // --- Init ---
    if (contentTextarea && !contentTextarea.value && localStorage.getItem('wiki_draft_content')) {
        if (confirm('Load unsaved draft from your last session?')) {
            contentTextarea.value = localStorage.getItem('wiki_draft_content');
            if (titleInput) titleInput.value = localStorage.getItem('wiki_draft_title');
            updateStats();
        }
    }

    if (hiddenCategoryInput.value) {
        tags = hiddenCategoryInput.value.split(',').map(t => t.trim()).filter(t => t);
        renderTags();
    }

    updateStats();
    fetchHistory();

    function attachEventListeners() {
        // Formatting Buttons
        const toolbarBtns = document.querySelectorAll('.toolbar-btn');
        toolbarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = btn.getAttribute('data-format') ||
                    btn.querySelector('i')?.className.replace('ph ph-text-', '').replace('ph ph-', '');
                insertFormatting(type);
            });
        });

        // Publish / Draft Buttons
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        const publishBtn = document.getElementById('publishBtn');

        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showCommitModal('draft');
            });
        }

        if (publishBtn) {
            publishBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showCommitModal('published');
            });
        }

        // Modal Buttons
        const cancelCommitBtn = document.getElementById('cancelCommitBtn');
        if (cancelCommitBtn) {
            cancelCommitBtn.addEventListener('click', closeCommitModal);
        }

        const closeVersionPreviewBtn = document.getElementById('closeVersionPreviewBtn');
        if (closeVersionPreviewBtn) closeVersionPreviewBtn.addEventListener('click', closeVersionPreview);

        const closeVersionPreviewX = document.querySelector('#versionPreviewModal .close');
        if (closeVersionPreviewX) closeVersionPreviewX.addEventListener('click', closeVersionPreview);

        const mobileHistoryToggleBtn = document.getElementById('mobileHistoryToggleBtn');
        if (mobileHistoryToggleBtn) mobileHistoryToggleBtn.addEventListener('click', toggleMobileHistory);

        // Fix for required hidden slug
        if (slugInput && slugInput.parentElement.style.display === 'none') {
            slugInput.required = false;
        }
    }

    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachEventListeners);
    } else {
        attachEventListeners();
    }

    // Make functions globally available for legacy or external calls if strictly needed
    window.insertFormatting = insertFormatting;
    window.showCommitModal = showCommitModal;
    window.closeCommitModal = closeCommitModal;
    window.closeVersionPreview = closeVersionPreview;
    window.previewVersion = previewVersion;
    window.confirmRestore = confirmRestore;
    window.discardChanges = discardChanges;
})();
