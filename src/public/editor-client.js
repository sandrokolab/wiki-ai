(function () {
    // DOM Elements
    const titleInput = document.getElementById('title');
    const slugInput = document.getElementById('slug');
    const slugPreview = document.getElementById('slugPreviewValue');
    const editSlugBtn = document.getElementById('editSlugBtn');
    const tagInput = document.getElementById('tagInput');
    const tagsContainer = document.getElementById('tagsContainer');
    const hiddenCategoryInput = document.getElementById('category');
    const contentTextarea = document.getElementById('content');
    const previewContent = document.getElementById('previewContent');
    const charCount = document.getElementById('charCount');
    const readTime = document.getElementById('readTime');
    const advancedOptionsBtn = document.getElementById('advancedOptionsBtn');
    const optionsContent = document.getElementById('optionsContent');
    const mobileEditTab = document.getElementById('mobileEditTab');
    const mobilePreviewTab = document.getElementById('mobilePreviewTab');
    const editCol = document.getElementById('editCol');
    const previewCol = document.getElementById('previewCol');
    const backBtn = document.getElementById('backBtn');
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    const draftStatus = document.getElementById('draftStatus');

    let tags = [];
    let isDirty = false;

    // --- Configuration ---
    const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

    // --- Helpers ---
    function slugify(text) {
        return text.toString().toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    }

    function updatePreview() {
        if (typeof marked !== 'undefined') {
            const rawContent = contentTextarea.value;
            previewContent.innerHTML = rawContent ? marked.parse(rawContent) : '<div class="preview-placeholder">Your content preview will appear here...</div>';
        }
        updateStats();
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
    }

    function clearDirty() {
        isDirty = false;
        if (unsavedIndicator) unsavedIndicator.style.display = 'none';
    }

    // --- Slug Logic ---
    let manualSlug = false;
    titleInput.addEventListener('input', () => {
        if (!manualSlug) {
            const slug = slugify(titleInput.value);
            slugInput.value = slug;
            slugPreview.textContent = slug || '[slug]';
        }
        setDirty();
    });

    slugInput.addEventListener('input', () => {
        manualSlug = true;
        slugInput.value = slugify(slugInput.value);
        slugPreview.textContent = slugInput.value || '[slug]';
        setDirty();
    });

    editSlugBtn.addEventListener('click', (e) => {
        e.preventDefault();
        slugInput.parentElement.style.display = 'block';
        editSlugBtn.style.display = 'none';
    });

    // --- Tag System ---
    function renderTags() {
        const existingPills = tagsContainer.querySelectorAll('.tag-pill');
        existingPills.forEach(p => p.remove());

        tags.forEach((tag, index) => {
            const pill = document.createElement('div');
            pill.className = 'tag-pill';
            pill.innerHTML = `<span>${tag}</span><button type="button" data-index="${index}">&times;</button>`;
            tagsContainer.insertBefore(pill, tagInput);
        });

        hiddenCategoryInput.value = tags.join(', ');
    }

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
        } else if (e.key === 'Backspace' && !tagInput.value && tags.length > 0) {
            tags.pop();
            renderTags();
            setDirty();
        }
    });

    tagsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const idx = e.target.getAttribute('data-index');
            tags.splice(idx, 1);
            renderTags();
            setDirty();
        }
    });

    // --- Editor Logic ---
    contentTextarea.addEventListener('input', () => {
        updatePreview();
        setDirty();
    });

    // Tab support (2 spaces)
    contentTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = contentTextarea.selectionStart;
            const end = contentTextarea.selectionEnd;
            contentTextarea.value = contentTextarea.value.substring(0, start) + "  " + contentTextarea.value.substring(end);
            contentTextarea.selectionStart = contentTextarea.selectionEnd = start + 2;
        }
    });

    // --- Toolbar Actions ---
    window.insertFormatting = function (type) {
        const start = contentTextarea.selectionStart;
        const end = contentTextarea.selectionEnd;
        const text = contentTextarea.value;
        const selected = text.substring(start, end);
        let replacement = '';

        switch (type) {
            case 'bold': replacement = `**${selected || 'bold text'}**`; break;
            case 'italic': replacement = `*${selected || 'italic text'}*`; break;
            case 'h1': replacement = `\n# ${selected || 'Heading 1'}`; break;
            case 'h2': replacement = `\n## ${selected || 'Heading 2'}`; break;
            case 'list-bullet': replacement = `\n- ${selected || 'item'}`; break;
            case 'list-number': replacement = `\n1. ${selected || 'item'}`; break;
            case 'check': replacement = `\n- [ ] ${selected || 'task'}`; break;
            case 'link': replacement = `[${selected || 'link text'}](https://example.com)`; break;
            case 'image': replacement = `![${selected || 'alt text'}](https://example.com/image.jpg)`; break;
            case 'code': replacement = `\`${selected || 'code'}\``; break;
            case 'quote': replacement = `\n> ${selected || 'quote'}`; break;
        }

        contentTextarea.value = text.substring(0, start) + replacement + text.substring(end);
        contentTextarea.focus();
        updatePreview();
        setDirty();
    };

    // --- Advanced Options ---
    advancedOptionsBtn.addEventListener('click', () => {
        optionsContent.classList.toggle('show');
        advancedOptionsBtn.querySelector('i').className = optionsContent.classList.contains('show') ? 'ph ph-caret-up' : 'ph ph-caret-down';
    });

    // --- Mobile Tabs ---
    mobileEditTab.addEventListener('click', () => {
        mobileEditTab.classList.add('active');
        mobilePreviewTab.classList.remove('active');
        editCol.classList.remove('hide');
        previewCol.classList.remove('show');
    });

    mobilePreviewTab.addEventListener('click', () => {
        mobilePreviewTab.classList.add('active');
        mobileEditTab.classList.remove('active');
        editCol.classList.add('hide');
        previewCol.classList.add('show');
        updatePreview();
    });

    // --- Shortcuts ---
    window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdCtrl = isMac ? e.metaKey : e.ctrlKey;

        if (cmdCtrl) {
            if (e.key === 's') {
                e.preventDefault();
                saveDraft();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                document.querySelector('.wiki-form').submit();
            } else if (e.key === 'b') {
                e.preventDefault();
                insertFormatting('bold');
            } else if (e.key === 'i') {
                e.preventDefault();
                insertFormatting('italic');
            } else if (e.key === 'k') {
                e.preventDefault();
                insertFormatting('link');
            }
        }
    });

    // --- Auto-save ---
    function saveDraft() {
        if (!isDirty) return;
        localStorage.setItem('wiki_draft_content', contentTextarea.value);
        localStorage.setItem('wiki_draft_title', titleInput.value);
        if (draftStatus) {
            draftStatus.textContent = 'Draft saved locally';
            setTimeout(() => draftStatus.textContent = '', 3000);
        }
        clearDirty();
    }

    setInterval(saveDraft, AUTO_SAVE_INTERVAL);

    // --- Unsaved Changes Warning ---
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // --- Init ---
    // Load from local storage if exists and empty
    if (!contentTextarea.value && localStorage.getItem('wiki_draft_content')) {
        if (confirm('Load unsaved draft from your last session?')) {
            contentTextarea.value = localStorage.getItem('wiki_draft_content');
            titleInput.value = localStorage.getItem('wiki_draft_title');
            slugInput.value = slugify(titleInput.value);
            slugPreview.textContent = slugInput.value;
            updatePreview();
        }
    }

    // Initialize tags from existing hidden input if editing
    if (hiddenCategoryInput.value) {
        tags = hiddenCategoryInput.value.split(',').map(t => t.trim()).filter(t => t);
        renderTags();
    }

    updatePreview();
})();
