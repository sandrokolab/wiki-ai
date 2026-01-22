(function () {
    // Dropdown toggle logic
    document.addEventListener('click', function (e) {
        // Toggle Create Post Dropdown
        const createTrigger = e.target.closest('#createPostDropdownTrigger .btn-magenta-arrow');
        if (createTrigger) {
            e.preventDefault();
            const dropdown = document.getElementById('createPostDropdown');
            dropdown.classList.toggle('show');
            return;
        }

        // Toggle Page Dots Menu
        const pageTrigger = e.target.closest('#pageMenuTrigger');
        if (pageTrigger) {
            e.preventDefault();
            const dropdown = document.getElementById('pageMenu');
            dropdown.classList.toggle('show');
            return;
        }

        // Close all dropdowns if clicking outside
        if (!e.target.closest('.dropdown-container')) {
            closeAllDropdowns();
        }
    });

    function closeAllDropdowns() {
        document.querySelectorAll('.slab-dropdown').forEach(d => {
            d.classList.remove('show');
        });
    }

    // Helper functions
    window.copyToClipboard = function (slug) {
        const url = window.location.origin + '/wiki/' + slug;
        navigator.clipboard.writeText(url).then(() => {
            // Visual feedback (toast or simple alert for now)
            showToast('Link copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed', err);
        });
    };

    function showToast(message) {
        // Simple toast implementation
        let toast = document.getElementById('slab-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'slab-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 2rem;
                left: 50%;
                transform: translateX(-50%);
                background: #1a1a2e;
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                z-index: 2000;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
                transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    // Close on Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllDropdowns();
    });

    window.toggleFavorite = async function (slug) {
        try {
            const res = await fetch(`/wiki/${slug}/favorite`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                location.reload(); // Simple reload to update state
            } else {
                showToast(data.error || 'Failed to toggle favorite');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error');
        }
    };

    window.publishPage = async function (slug) {
        if (!confirm('Are you sure you want to publish this draft?')) return;
        try {
            const res = await fetch(`/wiki/${slug}/publish`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('Page published successfully!');
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast(data.error || 'Failed to publish');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error');
        }
    };

    window.openMoveTopicModal = function (slug) {
        showToast('Move to topic functionality coming soon!');
    };
})();
