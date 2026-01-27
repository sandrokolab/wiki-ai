(function () {
    const activityFeed = document.getElementById('activityFeed');
    let lastActivityId = null;

    // Initial last ID
    const firstItem = activityFeed ? activityFeed.querySelector('.activity-item') : null;
    if (firstItem) {
        // ...
    }

    async function fetchActivity() {
        try {
            const res = await fetch(`/w/${window.wikiContext.slug}/api/activity`);
            const data = await res.json();
            if (data && data.length > 0) {
                renderActivity(data);
            }
        } catch (err) {
            console.error('Activity fetch error:', err);
        }
    }

    function renderActivity(activities) {
        // Simple diff: check if the first activity's ID is different from what we had
        const latestId = activities[0].id;

        // If it's the same, do nothing
        if (window.lastFetchedActivityId === latestId) return;

        // If it's different, update the feed
        let html = '';
        activities.forEach(act => {
            const activityLink = act.action_type === 'created_topic'
                ? `/w/${window.wikiContext.slug}/categoria/${act.metadata?.name || 'Topic'}`
                : `/w/${window.wikiContext.slug}/wiki/${act.slug || ''}`;
            const displayTitle = act.title || act.metadata?.name || 'Untitled';
            const displayTopic = act.topic_name || (act.action_type === 'created_topic' ? act.metadata?.name : null);
            const actionText = act.action_type === 'published' ? 'published a post'
                : act.action_type === 'created_topic' ? 'created a new topic'
                    : 'edited a post';

            html += `
                <div class="activity-item" onclick="window.location.href='${activityLink}'">
                    <div class="act-avatar" title="${act.username}">
                        ${act.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="act-content">
                        <p class="act-text">
                            <strong>${act.username}</strong> 
                            ${actionText}
                        </p>
                        <div class="act-card">
                            ${(displayTopic && act.action_type !== 'created_topic') ? `<span class="act-card-topic" style="color: ${act.topic_color || '#6b7280'}">Part of ${displayTopic}</span>` : ''}
                            <span class="act-card-title">${displayTitle}</span>
                            ${(act.content || act.metadata?.description) ? `
                            <div class="act-card-preview">
                                ${(act.content || act.metadata?.description || '').substring(0, 100).replace(/[#*`]/g, '')}...
                            </div>` : ''}
                        </div>
                        <div class="act-meta">
                            <span class="act-time">
                                ${new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            ${act.topic_name ? `<a href="/w/${window.wikiContext.slug}/categoria/${act.topic_name}" class="act-topic-link">in: ${act.topic_name}</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        // Add a subtle indicator to the header if there's new stuff since page load
        if (window.lastFetchedActivityId !== undefined && window.lastFetchedActivityId !== latestId) {
            showNewActivityIndicator();
        }

        if (activityFeed) activityFeed.innerHTML = html;
        window.lastFetchedActivityId = latestId;
    }

    function showNewActivityIndicator() {
        const header = document.querySelector('.sidebar-right-header h3');
        if (header && !header.querySelector('.new-activity-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'new-activity-indicator';
            header.appendChild(indicator);

            // Auto-hide indicator after 10s or on scroll/click potentially
            setTimeout(() => indicator.remove(), 10000);
        }
    }

    // Polling every 30 seconds
    setInterval(fetchActivity, 30000);

    // Initial set
    if (activityFeed && activityFeed.children.length > 0) {
        // We could extract the first ID here, but since the first fetch will happen in 30s anyway, 
        // we'll just let it run.
    }
})();
