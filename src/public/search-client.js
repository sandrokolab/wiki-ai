(function () {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const searchBoxContainer = document.getElementById('searchBoxContainer');
    const kbdKey = document.getElementById('kbd-key');

    // Update kbd shortcut for non-mac users
    if (navigator.platform.toUpperCase().indexOf('MAC') === -1) {
        kbdKey.textContent = 'Ctrl+';
    }

    let searchTimeout;
    let selectedIndex = -1;
    let totalItems = 0;

    // KEYBOARD SHORTCUTS
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            closeSearch();
        }
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            closeSearch();
            return;
        }

        searchTimeout = setTimeout(() => performSearch(query), 300);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            searchDropdown.style.display = 'block';
        }
    });

    // NAVIGATION
    searchInput.addEventListener('keydown', (e) => {
        const items = searchDropdown.querySelectorAll('.search-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items);
        } else if (e.key === 'Enter') {
            if (selectedIndex > -1 && items[selectedIndex]) {
                e.preventDefault();
                items[selectedIndex].click();
            }
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!searchBoxContainer.contains(e.target) && !searchDropdown.contains(e.target)) {
            closeSearch();
        }
    });

    async function performSearch(query) {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            renderResults(data, query);
        } catch (err) {
            console.error('Search error:', err);
        }
    }

    function renderResults(data, query) {
        let html = '';
        selectedIndex = -1;
        totalItems = 0;

        const sections = [
            { title: 'Pages', items: data.pages, icon: 'ph-file-text', linkPrefix: '/wiki/' },
            { title: 'Topics', items: data.topics, icon: 'ph-bookmark', linkPrefix: '/categoria/' },
            { title: 'Users', items: data.users, icon: 'ph-user', linkPrefix: '/profile/' }
        ];

        sections.forEach(section => {
            if (section.items && section.items.length > 0) {
                html += `<div class="search-section-title">${section.title}</div>`;
                section.items.forEach(item => {
                    const title = item.title || item.name || item.username;
                    const slug = item.slug || item.name || item.username;
                    const highlighted = highlight(title, query);
                    const snippet = item.content ? `<div class="search-snippet">${item.content.substring(0, 60)}...</div>` : '';
                    const topicLabel = item.category ? `<span class="search-topic-tag">${item.category}</span>` : '';

                    html += `
                        <a href="${section.linkPrefix}${slug}" class="search-item">
                            <i class="ph ${section.icon}"></i>
                            <div class="search-item-info">
                                <div class="search-item-title">${highlighted} ${topicLabel}</div>
                                ${snippet}
                            </div>
                        </a>
                    `;
                    totalItems++;
                });
            }
        });

        if (totalItems === 0) {
            html = '<div class="search-no-results">No matches found.</div>';
        }

        searchDropdown.innerHTML = html;
        searchDropdown.style.display = 'block';
    }

    function highlight(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function updateSelection(items) {
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
            if (i === selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function closeSearch() {
        searchDropdown.style.display = 'none';
        selectedIndex = -1;
    }
})();
